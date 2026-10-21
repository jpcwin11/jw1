(function () {
  'use strict';

  const APPS = {
    notes: { label: 'NOTES', glyph: '📝', title: 'NOTES.TXT — recovered', w: 300, h: 240, x: 48, y: 52 },
    clock: { label: 'CLOCK', glyph: '🕐', title: 'CLOCK.EXE', w: 260, h: 200, x: 130, y: 88 },
    trash: { label: 'TRASH', glyph: '🗑', title: 'RECYCLE BIN', w: 320, h: 280, x: 200, y: 120 },
    radio: { label: 'RADIO', glyph: '📻', title: 'RADIO // JW1-03', w: 340, h: 260, x: 72, y: 160 },
  };

  const WIN_PHRASE = 'still here';

  function el(tag, className, html) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (html != null) node.innerHTML = html;
    return node;
  }

  function normalizePhrase(value) {
    return value.trim().toLowerCase().replace(/\s+/g, ' ');
  }

  window.initPhantomDesk = function initPhantomDesk(rootEl) {
    if (!rootEl || !(rootEl instanceof HTMLElement)) {
      return null;
    }

    rootEl.innerHTML = '';
    rootEl.classList.add('pd-mount');

    let zIndex = 10;
    let won = false;
    let selectedIcon = null;
    const openWindows = new Map();
    const timeouts = [];
    const intervals = [];
    let radioRaf = 0;
    let dragState = null;

    const desktop = el('div', 'pd-desktop');
    const wallpaper = el('div', 'pd-wallpaper');
    const flicker = el('div', 'pd-flicker');
    const ghostMark = el('div', 'pd-ghost-mark', '⌁');
    const iconsWrap = el('div', 'pd-icons');
    const windowsLayer = el('div', 'pd-windows');
    const hudHint = el(
      'div',
      'pd-hud-hint',
      '<b>PHANTOM DESK</b> — double-click icons · drag title bars'
    );
    const taskbar = el('div', 'pd-taskbar');
    const taskApps = el('div', 'pd-taskbar-apps');
    const taskClock = el('span', 'pd-taskbar-clock');
    const victory = el('div', 'pd-victory', '');
    victory.hidden = true;

    taskbar.appendChild(el('span', 'pd-taskbar-brand', 'PHANTOM OS'));
    taskbar.appendChild(taskApps);
    taskbar.appendChild(taskClock);

    desktop.append(wallpaper, flicker, ghostMark, iconsWrap, windowsLayer, hudHint, taskbar, victory);
    rootEl.appendChild(desktop);

    function schedule(fn, ms) {
      const id = window.setTimeout(fn, ms);
      timeouts.push(id);
      return id;
    }

    function focusWindow(win) {
      zIndex += 1;
      win.style.zIndex = String(zIndex);
      windowsLayer.querySelectorAll('.pd-window').forEach(w => {
        w.classList.toggle('pd-window-focused', w === win);
      });
      const appId = win.dataset.app;
      taskApps.querySelectorAll('.pd-taskbar-app').forEach(btn => {
        btn.classList.toggle('pd-active', btn.dataset.app === appId);
      });
    }

    function updateTaskbar() {
      taskApps.innerHTML = '';
      openWindows.forEach((win, appId) => {
        const btn = el('button', 'pd-taskbar-app', APPS[appId].label);
        btn.type = 'button';
        btn.dataset.app = appId;
        btn.classList.toggle('pd-active', win.classList.contains('pd-window-focused'));
        btn.addEventListener('click', () => {
          if (win.classList.contains('pd-window-hidden')) {
            win.classList.remove('pd-window-hidden');
          }
          focusWindow(win);
        });
        taskApps.appendChild(btn);
      });
    }

    function closeWindow(appId) {
      const win = openWindows.get(appId);
      if (!win) return;
      win.remove();
      openWindows.delete(appId);
      updateTaskbar();
    }

    function minimizeWindow(appId) {
      const win = openWindows.get(appId);
      if (!win) return;
      win.classList.add('pd-window-hidden');
      updateTaskbar();
    }

    function buildNotesBody() {
      return el(
        'div',
        'pd-notes',
        `<p><span class="pd-redacted">▓▓▓▓</span> / fragment recovered</p>
<p>the desktop feels wrong after midnight.</p>
<p>check the bin. something you wrote is still in there.</p>
<hr />
<p>03:17 — clock stuck again</p>
<p>the radio keeps asking if anyone is listening.</p>
<p>type it back.</p>`
      );
    }

    function buildClockBody() {
      const wrap = el('div', 'pd-clock-face');
      const digits = el('div', 'pd-clock-digits', '--:--:--');
      const caption = el('div', 'pd-clock-caption', 'local haunted time');
      const stopped = el('div', 'pd-clock-stopped', 'last stable reading: 03:17:00');
      wrap.append(digits, caption, stopped);

      function tick() {
        const now = new Date();
        digits.textContent = now.toLocaleTimeString(undefined, { hour12: false });
        taskClock.textContent = now.toLocaleTimeString(undefined, {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        });
      }
      tick();
      intervals.push(window.setInterval(tick, 1000));

      schedule(() => {
        digits.classList.add('pd-glitch');
        digits.textContent = '03:17:00';
        schedule(() => {
          digits.classList.remove('pd-glitch');
          tick();
        }, 400);
      }, 4500 + Math.random() * 4000);

      return wrap;
    }

    function buildTrashBody() {
      const wrap = el('div');
      wrap.appendChild(
        el(
          'ul',
          'pd-trash-list',
          `<li>readme_old.txt</li>
<li>draft_radio.log</li>
<li>last_words.tmp</li>`
        )
      );
      const search = el('div', 'pd-trash-search');
      const label = el('label', '', 'Search deleted files');
      const input = el('input');
      input.type = 'text';
      input.autocomplete = 'off';
      input.spellcheck = false;
      input.placeholder = 'recover a phrase…';
      const hint = el('div', 'pd-trash-hint', '');

      label.appendChild(input);
      search.append(label, hint);
      wrap.appendChild(search);

      function checkWin() {
        if (won) return;
        const val = normalizePhrase(input.value);
        if (val.length >= 4 && WIN_PHRASE.startsWith(val)) {
          hint.textContent = '…something remembers.';
          hint.classList.add('pd-trash-warm');
        } else {
          hint.classList.remove('pd-trash-warm');
          hint.textContent = val ? 'no match in deleted index' : '';
        }
        if (val === WIN_PHRASE) {
          triggerWin();
        }
      }

      input.addEventListener('input', checkWin);
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') checkWin();
      });

      return wrap;
    }

    function buildRadioBody() {
      const wrap = el('div', 'pd-radio-wrap');
      const canvas = el('canvas', 'pd-radio-canvas');
      canvas.width = 280;
      canvas.height = 120;
      const text = el('div', 'pd-radio-text', 'scanning…');
      const meter = el(
        'div',
        'pd-radio-meter',
        '<span>STRENGTH</span><div class="pd-radio-bar"><i></i></div>'
      );
      wrap.append(canvas, text, meter);

      const ctx = canvas.getContext('2d');
      const fragments = [
        '…can you hear—',
        '…still…',
        '…here…?',
        '…still here…',
        '…do not empty the bin…',
      ];
      let fragIndex = 0;

      schedule(function cycleText() {
        text.textContent = fragments[fragIndex % fragments.length];
        fragIndex += 1;
        schedule(cycleText, 2200 + Math.random() * 1800);
      }, 800);

      function drawStatic() {
        if (won) return;
        const w = canvas.width;
        const h = canvas.height;
        const imageData = ctx.createImageData(w, h);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
          const v = Math.random() * 255;
          data[i] = v * 0.3;
          data[i + 1] = v * 0.55;
          data[i + 2] = v;
          data[i + 3] = 40 + Math.random() * 80;
        }
        ctx.putImageData(imageData, 0, 0);
        ctx.fillStyle = '#51d9ff22';
        ctx.fillRect(0, h * 0.4 + Math.random() * 20, w, 2);
        radioRaf = window.requestAnimationFrame(drawStatic);
      }
      drawStatic();

      return wrap;
    }

    const bodyBuilders = {
      notes: buildNotesBody,
      clock: buildClockBody,
      trash: buildTrashBody,
      radio: buildRadioBody,
    };

    function triggerWin() {
      if (won) return;
      won = true;
      if (radioRaf) window.cancelAnimationFrame(radioRaf);
      victory.innerHTML = `<div class="pd-victory-card">
<h2>CONNECTION ESTABLISHED</h2>
<p>You typed it back. The desk exhales. Something that was deleted is still here.</p>
</div>`;
      victory.hidden = false;
      rootEl.dispatchEvent(
        new CustomEvent('phantom-desk-win', { bubbles: true, detail: { phrase: WIN_PHRASE } })
      );
    }

    function attachDrag(win, titlebar) {
      titlebar.addEventListener('pointerdown', e => {
        if (e.button !== 0) return;
        focusWindow(win);
        const rect = win.getBoundingClientRect();
        const layerRect = windowsLayer.getBoundingClientRect();
        dragState = {
          win,
          offsetX: e.clientX - rect.left,
          offsetY: e.clientY - rect.top,
          layerRect,
        };
        titlebar.setPointerCapture(e.pointerId);
        e.preventDefault();
      });

      titlebar.addEventListener('pointermove', e => {
        if (!dragState || dragState.win !== win) return;
        const maxX = dragState.layerRect.width - win.offsetWidth;
        const maxY = dragState.layerRect.height - win.offsetHeight;
        let x = e.clientX - dragState.layerRect.left - dragState.offsetX;
        let y = e.clientY - dragState.layerRect.top - dragState.offsetY;
        x = Math.max(0, Math.min(maxX, x));
        y = Math.max(0, Math.min(maxY, y));
        win.style.left = `${x}px`;
        win.style.top = `${y}px`;
      });

      titlebar.addEventListener('pointerup', e => {
        if (dragState && dragState.win === win) {
          dragState = null;
          titlebar.releasePointerCapture(e.pointerId);
        }
      });

      titlebar.addEventListener('pointercancel', () => {
        dragState = null;
      });
    }

    function openApp(appId) {
      if (openWindows.has(appId)) {
        const existing = openWindows.get(appId);
        existing.classList.remove('pd-window-hidden');
        focusWindow(existing);
        return existing;
      }

      const spec = APPS[appId];
      const win = el('div', 'pd-window');
      win.dataset.app = appId;
      win.style.width = `${spec.w}px`;
      win.style.height = `${spec.h}px`;
      win.style.left = `${spec.x}px`;
      win.style.top = `${spec.y}px`;

      const titlebar = el('div', 'pd-window-titlebar');
      titlebar.appendChild(el('span', 'pd-window-title', spec.title));
      const controls = el('div', 'pd-window-controls');
      const minBtn = el('button', 'pd-window-btn', '−');
      minBtn.type = 'button';
      minBtn.title = 'Minimize';
      const closeBtn = el('button', 'pd-window-btn pd-close', '×');
      closeBtn.type = 'button';
      closeBtn.title = 'Close';
      controls.append(minBtn, closeBtn);
      titlebar.appendChild(controls);

      const body = el('div', 'pd-window-body');
      body.appendChild(bodyBuilders[appId]());

      win.append(titlebar, body);
      windowsLayer.appendChild(win);
      openWindows.set(appId, win);

      minBtn.addEventListener('click', e => {
        e.stopPropagation();
        minimizeWindow(appId);
      });
      closeBtn.addEventListener('click', e => {
        e.stopPropagation();
        closeWindow(appId);
      });
      win.addEventListener('pointerdown', () => focusWindow(win));

      attachDrag(win, titlebar);
      focusWindow(win);
      updateTaskbar();

      if (appId === 'trash') {
        const input = win.querySelector('.pd-trash-search input');
        if (input) schedule(() => input.focus(), 80);
      }

      return win;
    }

    Object.keys(APPS).forEach(appId => {
      const spec = APPS[appId];
      const icon = el('button', 'pd-icon');
      icon.type = 'button';
      icon.dataset.app = appId;
      icon.setAttribute('aria-label', `Open ${spec.label}`);
      icon.append(el('span', 'pd-icon-glyph', spec.glyph), el('span', 'pd-icon-label', spec.label));

      icon.addEventListener('click', () => {
        iconsWrap.querySelectorAll('.pd-icon').forEach(i => i.classList.remove('pd-icon-selected'));
        icon.classList.add('pd-icon-selected');
        selectedIcon = appId;
      });

      icon.addEventListener('dblclick', () => openApp(appId));

      iconsWrap.appendChild(icon);
    });

    function randomFlicker() {
      if (won) return;
      flicker.classList.remove('pd-flicker-on');
      void flicker.offsetWidth;
      flicker.classList.add('pd-flicker-on');
      schedule(randomFlicker, 3000 + Math.random() * 7000);
    }
    schedule(randomFlicker, 2000);

    openApp('notes');

    function destroy() {
      timeouts.forEach(id => window.clearTimeout(id));
      intervals.forEach(id => window.clearInterval(id));
      timeouts.length = 0;
      intervals.length = 0;
      if (radioRaf) window.cancelAnimationFrame(radioRaf);
      dragState = null;
      rootEl.innerHTML = '';
      rootEl.classList.remove('pd-mount');
    }

    return { destroy, openApp };
  };
})();
