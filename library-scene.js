import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

(() => {
  const page = document.querySelector('[data-page="library"]');
  const mount = document.querySelector('#library-scene');
  const status = document.querySelector('[data-library-status]');
  const resetButton = document.querySelector('[data-library-reset]');
  if (!page || !mount) return;

  let renderer;
  let scene;
  let camera;
  let tesseractField;
  let tesseracts = [];
  let frameId = 0;
  let started = false;
  let pointer = null;
  let startCameraZ = 18.5;
  let targetX = 0;
  let targetY = 0;
  let rotationX = 0;
  let rotationY = 0;
  const flyKeys = new Set();
  const forward = new THREE.Vector3();
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const edgeTransform = new THREE.Object3D();
  const edgeDirection = new THREE.Vector3();
  const edgeMidpoint = new THREE.Vector3();
  const edgeUp = new THREE.Vector3(0, 1, 0);

  function createHypercube(parent, edgeColor, nodeColor, scale, position, phase, edgeRadius, nodeSize) {
    const positions = [];
    const edges = [];
    for (let vertex = 0; vertex < 16; vertex++) {
      positions.push((vertex & 1) ? 1 : -1, (vertex & 2) ? 1 : -1, (vertex & 4) ? 1 : -1, (vertex & 8) ? 1 : -1);
      for (let axis = 0; axis < 4; axis++) {
        const neighbor = vertex ^ (1 << axis);
        if (vertex < neighbor) edges.push(vertex, neighbor);
      }
    }

    const edgeGeometry = new THREE.CylinderGeometry(edgeRadius, edgeRadius, 1, 5, 1, true);
    const edgeMaterial = new THREE.MeshBasicMaterial({ color: edgeColor, toneMapped: false });
    const edgeMesh = new THREE.InstancedMesh(edgeGeometry, edgeMaterial, edges.length / 2);
    edgeMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const nodeGeometry = new THREE.BufferGeometry();
    nodeGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(16 * 3), 3).setUsage(THREE.DynamicDrawUsage));
    const nodes = new THREE.Points(
      nodeGeometry,
      new THREE.PointsMaterial({ color: nodeColor, size: nodeSize, transparent: true, opacity: 0.95, sizeAttenuation: true, toneMapped: false })
    );
    const group = new THREE.Group();
    group.scale.setScalar(scale);
    group.position.set(...position);
    group.add(edgeMesh, nodes);
    parent.add(group);
    return { group, edgeMesh, nodeGeometry, edges, source: positions, phase };
  }

  function projectHypercube(cube, time) {
    const angle = time * 0.14 + cube.phase;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    const cosB = Math.cos(angle * 0.63 + 0.5);
    const sinB = Math.sin(angle * 0.63 + 0.5);
    const points = [];

    for (let index = 0; index < 16; index++) {
      let x = cube.source[index * 4];
      let y = cube.source[index * 4 + 1];
      const z = cube.source[index * 4 + 2];
      let w = cube.source[index * 4 + 3];
      const rotatedX = x * cosA - w * sinA;
      w = x * sinA + w * cosA;
      x = rotatedX;
      const rotatedY = y * cosB - w * sinB;
      w = y * sinB + w * cosB;
      y = rotatedY;
      const perspective = 2.8 / (3.4 - w * 0.48);
      points.push(new THREE.Vector3(x * perspective * 2.35, y * perspective * 2.35, z * perspective * 2.35));
    }

    for (let edgeIndex = 0; edgeIndex < cube.edges.length; edgeIndex += 2) {
      const instanceIndex = edgeIndex / 2;
      const start = points[cube.edges[edgeIndex]];
      const end = points[cube.edges[edgeIndex + 1]];
      edgeDirection.subVectors(end, start);
      edgeMidpoint.addVectors(start, end).multiplyScalar(0.5);
      edgeTransform.position.copy(edgeMidpoint);
      edgeTransform.quaternion.setFromUnitVectors(edgeUp, edgeDirection.clone().normalize());
      edgeTransform.scale.set(1, edgeDirection.length(), 1);
      edgeTransform.updateMatrix();
      cube.edgeMesh.setMatrixAt(instanceIndex, edgeTransform.matrix);
    }
    cube.edgeMesh.instanceMatrix.needsUpdate = true;
    const nodePositions = cube.nodeGeometry.attributes.position.array;
    points.forEach((point, index) => {
      nodePositions[index * 3] = point.x;
      nodePositions[index * 3 + 1] = point.y;
      nodePositions[index * 3 + 2] = point.z;
    });
    cube.nodeGeometry.attributes.position.needsUpdate = true;
  }

  function createScene() {
    const width = Math.max(1, mount.clientWidth);
    const height = Math.max(1, mount.clientHeight);
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    camera = new THREE.PerspectiveCamera(47, width / height, 0.1, 100);
    startCameraZ = width < 620 ? 22.5 : 18.5;
    camera.position.set(0, 0, startCameraZ);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    mount.replaceChildren(renderer.domElement);

    tesseractField = new THREE.Group();
    scene.add(tesseractField);
    tesseracts = [createHypercube(tesseractField, 0xff6500, 0xffb66f, 1.55, [0, 0, 0], 0, 0.024, 0.12)];

    const nestedScales = [1.18, 0.91, 0.69, 0.51, 0.37, 0.26, 0.17];
    nestedScales.forEach((scale, index) => {
      const blue = index % 2 === 0;
      tesseracts.push(createHypercube(
        tesseractField,
        blue ? 0x258dff : 0xf2f5ff,
        blue ? 0x91caff : 0xffffff,
        scale,
        [0, 0, 0],
        index * 0.42,
        0.021,
        0.07
      ));
    });
    resize();
  }

  function resize() {
    if (!renderer || !camera) return;
    const width = Math.max(1, mount.clientWidth);
    const height = Math.max(1, mount.clientHeight);
    camera.aspect = width / height;
    camera.fov = width < 620 ? 65 : 47;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }

  function animate(now) {
    if (!renderer || !page.classList.contains('active')) {
      frameId = 0;
      return;
    }
    const time = now * 0.001;
    const delta = Math.min((now - (animate.lastTime || now)) * 0.001, 0.05);
    animate.lastTime = now;
    if (!reducedMotion) {
      targetY += 0.00018;
      targetX = Math.sin(time * 0.11) * 0.035;
    }
    rotationX += (targetX - rotationX) * 0.035;
    rotationY += (targetY - rotationY) * 0.035;
    camera.getWorldDirection(forward);
    if (flyKeys.has('w')) camera.position.addScaledVector(forward, 7 * delta);
    if (flyKeys.has('s')) camera.position.addScaledVector(forward, -7 * delta);
    camera.position.z = THREE.MathUtils.clamp(camera.position.z, -30, 35);
    tesseractField.rotation.x = rotationX * 0.36;
    tesseractField.rotation.y = rotationY * 0.36;
    tesseractField.rotation.z = Math.sin(time * 0.2) * 0.012;
    tesseracts.forEach(cube => projectHypercube(cube, reducedMotion ? 0 : time));
    renderer.render(scene, camera);
    frameId = window.requestAnimationFrame(animate);
  }

  function enterScene() {
    if (!started) {
      try {
        createScene();
        started = true;
        if (status) status.textContent = 'Drag or use arrows to tilt. Focus the scene; W/S or scroll to fly.';
      } catch (error) {
        mount.textContent = 'This browser could not start the 3D library.';
        if (status) status.textContent = 'WebGL is unavailable in this browser.';
        return;
      }
    }
    resize();
    if (!frameId) frameId = window.requestAnimationFrame(animate);
  }

  function onPointerDown(event) {
    mount.focus();
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
    mount.setPointerCapture(event.pointerId);
  }

  function flyByWheel(event) {
    if (!page.classList.contains('active') || !camera) return;
    event.preventDefault();
    camera.getWorldDirection(forward);
    camera.position.addScaledVector(forward, event.deltaY * 0.012);
    camera.position.z = THREE.MathUtils.clamp(camera.position.z, -30, 35);
    if (status) status.textContent = event.deltaY > 0 ? 'Flying inward through the tesseracts.' : 'Flying outward through the tesseracts.';
  }

  function onPointerMove(event) {
    if (!pointer || pointer.id !== event.pointerId) return;
    const dx = event.clientX - pointer.x;
    const dy = event.clientY - pointer.y;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    targetY += dx * 0.006;
    targetX = THREE.MathUtils.clamp(targetX + dy * 0.005, -0.65, 0.65);
    if (status) status.textContent = 'The tesseracts tilt together.';
  }

  mount.addEventListener('pointerdown', onPointerDown);
  mount.addEventListener('pointermove', onPointerMove);
  mount.addEventListener('pointerup', () => { pointer = null; });
  mount.addEventListener('pointercancel', () => { pointer = null; });
  mount.addEventListener('wheel', flyByWheel, { passive: false });
  mount.addEventListener('keydown', event => {
    if (event.key.toLowerCase() === 'w' || event.key.toLowerCase() === 's') {
      flyKeys.add(event.key.toLowerCase());
      if (status) status.textContent = event.key.toLowerCase() === 'w' ? 'Flying inward through the tesseracts.' : 'Flying outward through the tesseracts.';
      event.preventDefault();
      return;
    }
    const step = 0.16;
    if (event.key === 'ArrowLeft') targetY -= step;
    else if (event.key === 'ArrowRight') targetY += step;
    else if (event.key === 'ArrowUp') targetX = THREE.MathUtils.clamp(targetX - step, -0.65, 0.65);
    else if (event.key === 'ArrowDown') targetX = THREE.MathUtils.clamp(targetX + step, -0.65, 0.65);
    else return;
    event.preventDefault();
  });
  mount.addEventListener('keyup', event => flyKeys.delete(event.key.toLowerCase()));
  resetButton?.addEventListener('click', () => {
    targetX = 0;
    targetY = 0;
    camera.position.set(0, 0, startCameraZ);
    flyKeys.clear();
    if (status) status.textContent = 'View reset. A room folded through itself.';
  });
  window.addEventListener('resize', resize);
  window.addEventListener('hashchange', () => {
    if (page.classList.contains('active')) enterScene();
    else if (frameId) {
      window.cancelAnimationFrame(frameId);
      frameId = 0;
      flyKeys.clear();
    }
  });

  if (page.classList.contains('active')) enterScene();
})();
