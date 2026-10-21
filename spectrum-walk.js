import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

(() => {
  const page = document.querySelector('[data-page="spectrum"]');
  const mount = document.querySelector('#spectrum-world');
  const startButton = document.querySelector('[data-walk-start]');
  const status = document.querySelector('[data-walk-status]');
  if (!page || !mount || !startButton) return;

  let renderer;
  let scene;
  let camera;
  let lineGeometry;
  let frameId = 0;
  let initialized = false;
  let started = false;
  let pointer = null;
  let yaw = 0;
  let pitch = 0;
  let lastTime = 0;
  const keys = new Set();
  const touchKeys = new Set();
  const direction = new THREE.Vector3();
  const color = new THREE.Color();
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function addLine(vertices, start, end) {
    vertices.push(...start, ...end);
  }

  function addBox(vertices, halfWidth, halfHeight, z) {
    const corners = [
      [-halfWidth, -halfHeight, z], [halfWidth, -halfHeight, z],
      [halfWidth, halfHeight, z], [-halfWidth, halfHeight, z],
      [-halfWidth, -halfHeight, z - 1.8], [halfWidth, -halfHeight, z - 1.8],
      [halfWidth, halfHeight, z - 1.8], [-halfWidth, halfHeight, z - 1.8]
    ];
    const edges = [0, 1, 1, 2, 2, 3, 3, 0, 4, 5, 5, 6, 6, 7, 7, 4, 0, 4, 1, 5, 2, 6, 3, 7];
    for (let index = 0; index < edges.length; index += 2) {
      addLine(vertices, corners[edges[index]], corners[edges[index + 1]]);
    }
    return corners;
  }

  function buildCorridor() {
    const vertices = [];
    let previousOuter;
    let previousInner;
    for (let layer = 0; layer < 30; layer++) {
      const z = 5 - layer * 4.4;
      const variation = Math.sin(layer * 0.63) * 0.32;
      const outer = addBox(vertices, 4.1 + variation, 3.1 + variation * 0.55, z);
      const inner = addBox(vertices, 1.8 + variation * 0.25, 1.35 + variation * 0.2, z + 0.25);
      if (previousOuter) {
        for (let index = 0; index < 4; index++) {
          addLine(vertices, previousOuter[index], outer[index]);
          addLine(vertices, previousOuter[index + 4], outer[index + 4]);
          addLine(vertices, previousInner[index], inner[index]);
          addLine(vertices, previousInner[index + 4], inner[index + 4]);
        }
      }
      for (let index = 0; index < 4; index += 1) {
        addLine(vertices, outer[index], inner[index]);
        addLine(vertices, outer[index + 4], inner[index + 4]);
      }
      if (layer % 2 === 0) {
        addLine(vertices, outer[0], outer[6]);
        addLine(vertices, outer[1], outer[7]);
        addLine(vertices, inner[0], inner[6]);
        addLine(vertices, inner[1], inner[7]);
      }
      previousOuter = outer;
      previousInner = inner;
    }

    lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    lineGeometry.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(vertices.length), 3));
    const lines = new THREE.LineSegments(lineGeometry, new THREE.LineBasicMaterial({
      vertexColors: true,
      toneMapped: false,
      transparent: true,
      opacity: 0.92
    }));
    scene.add(lines);
  }

  function updateRainbow(time) {
    const positions = lineGeometry.attributes.position.array;
    const colors = lineGeometry.attributes.color.array;
    const cycleRate = reducedMotion ? 0.035 : 0.13;
    for (let index = 0; index < positions.length; index += 3) {
      const depth = -positions[index + 2] * 0.007;
      const horizontal = Math.atan2(positions[index + 1], positions[index]) * 0.045;
      color.setHSL((time * cycleRate + depth + horizontal + 1) % 1, 1, 0.58);
      color.toArray(colors, index);
    }
    lineGeometry.attributes.color.needsUpdate = true;
  }

  function resize() {
    if (!renderer || !camera) return;
    const width = Math.max(1, mount.clientWidth);
    const height = Math.max(1, mount.clientHeight);
    camera.aspect = width / height;
    camera.fov = width < 620 ? 76 : 68;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }

  function createScene() {
    const width = Math.max(1, mount.clientWidth);
    const height = Math.max(1, mount.clientHeight);
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    camera = new THREE.PerspectiveCamera(68, width / height, 0.05, 180);
    camera.position.set(0, 0, 4.5);
    camera.rotation.order = 'YXZ';
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.replaceChildren(renderer.domElement);
    buildCorridor();
    resize();
  }

  function moveCamera(delta) {
    if (!started || delta <= 0) return;
    const forward = keys.has('KeyW') || keys.has('ArrowUp') || touchKeys.has('forward');
    const backward = keys.has('KeyS') || keys.has('ArrowDown');
    const left = keys.has('KeyA') || keys.has('ArrowLeft') || touchKeys.has('left');
    const right = keys.has('KeyD') || keys.has('ArrowRight') || touchKeys.has('right');
    const speed = 5.2 * delta;
    const forwardAmount = (forward ? 1 : 0) - (backward || touchKeys.has('back') ? 1 : 0);
    const strafeAmount = (right ? 1 : 0) - (left ? 1 : 0);
    direction.set(-Math.sin(yaw), 0, -Math.cos(yaw));
    camera.position.addScaledVector(direction, forwardAmount * speed);
    direction.set(Math.cos(yaw), 0, -Math.sin(yaw));
    camera.position.addScaledVector(direction, strafeAmount * speed);
    if (camera.position.z < -125) camera.position.z = 4.5;
    if (camera.position.z > 8) camera.position.z = -121;
  }

  function animate(now) {
    if (!renderer || !page.classList.contains('active')) {
      frameId = 0;
      return;
    }
    const time = now * 0.001;
    const delta = lastTime ? Math.min((now - lastTime) * 0.001, 0.05) : 0;
    lastTime = now;
    camera.rotation.set(pitch, yaw, 0, 'YXZ');
    moveCamera(delta);
    updateRainbow(time);
    renderer.render(scene, camera);
    frameId = window.requestAnimationFrame(animate);
  }

  function enterPage() {
    if (!initialized) {
      try {
        createScene();
        initialized = true;
      } catch (error) {
        mount.textContent = 'This browser could not start the 3D view.';
        status.textContent = 'WebGL is unavailable.';
        return;
      }
    }
    resize();
    if (!frameId) frameId = window.requestAnimationFrame(animate);
  }

  function startWalking() {
    started = true;
    startButton.textContent = 'WALKING';
    status.textContent = 'WASD to move. Drag or touch to look.';
    mount.focus();
  }

  startButton.addEventListener('click', startWalking);
  mount.addEventListener('click', () => {
    if (!started) startWalking();
  });
  mount.addEventListener('pointerdown', event => {
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
    mount.setPointerCapture(event.pointerId);
  });
  mount.addEventListener('pointermove', event => {
    if (!pointer || pointer.id !== event.pointerId || !started) return;
    const dx = event.clientX - pointer.x;
    const dy = event.clientY - pointer.y;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    yaw -= dx * 0.004;
    pitch = THREE.MathUtils.clamp(pitch - dy * 0.004, -1.25, 1.25);
  });
  mount.addEventListener('pointerup', () => { pointer = null; });
  mount.addEventListener('pointercancel', () => { pointer = null; });

  window.addEventListener('keydown', event => {
    if (!page.classList.contains('active')) return;
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
      keys.add(event.code);
      event.preventDefault();
    }
  });
  window.addEventListener('keyup', event => keys.delete(event.code));
  document.querySelectorAll('[data-walk-move]').forEach(button => {
    const directionName = button.dataset.walkMove;
    button.addEventListener('pointerdown', event => {
      event.preventDefault();
      touchKeys.add(directionName);
      button.setPointerCapture(event.pointerId);
    });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => {
      button.addEventListener(type, () => touchKeys.delete(directionName));
    });
  });
  window.addEventListener('resize', resize);
  window.addEventListener('hashchange', () => {
    if (page.classList.contains('active')) enterPage();
    else {
      lastTime = 0;
      if (frameId) {
        window.cancelAnimationFrame(frameId);
        frameId = 0;
      }
    }
  });
  if (page.classList.contains('active')) enterPage();
})();
