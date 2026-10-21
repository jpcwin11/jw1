const arcadeState = { position: 0, score: 0, finished: false };
const packetState = { path: ['A'], finished: false };
const storyNodes = {
  root: {
    label: 'ENTRY 01 / A MEMORY',
    title: 'The desk by the window',
    copy: 'A thought leaves a faint trail. Follow it and it may lead somewhere no index could predict.',
    choices: [['thread', 'Follow the thread →'], ['footnote', 'Open the footnote →'], ['index', 'Return to the index']]
  },
  thread: {
    label: 'ENTRY 02 / THE THREAD',
    title: 'A path through the margin',
    copy: 'One remembered sentence points to another. Someone has drawn a line between the two.',
    choices: [['cross', 'Follow the cross-reference →'], ['index', 'Return to the index']]
  },
  footnote: {
    label: 'ENTRY 03 / A FOOTNOTE',
    title: 'A note beneath the note',
    copy: 'The footnote is not an ending. It is a small door left open in the wall.',
    choices: [['margin', 'Inspect the open door →'], ['index', 'Return to the index']]
  },
  cross: {
    label: 'ENTRY 04 / LINK FOUND',
    title: 'The first link',
    copy: 'You followed an idea to another idea. A web begins wherever a connection is remembered.',
    choices: [['index', 'Begin again at the index']]
  },
  margin: {
    label: 'ENTRY 04 / LINK FOUND',
    title: 'The first link',
    copy: 'You followed an idea to another idea. A web begins wherever a connection is remembered.',
    choices: [['index', 'Begin again at the index']]
  }
};

function renderArcade(message) {
  const track = document.querySelector('[data-arcade-track]');
  if (!track) return;
  track.innerHTML = Array.from({ length: 10 }, (_, index) => {
    const classes = ['arcade-tile'];
    if ([2, 6].includes(index)) classes.push('gap');
    else if ([4, 8].includes(index)) classes.push('obstacle');
    if (index === arcadeState.position) classes.push('player');
    return `<span class="${classes.join(' ')}" aria-hidden="true"></span>`;
  }).join('');
  document.querySelector('[data-arcade-score]').textContent = String(arcadeState.score).padStart(3, '0');
  const messageElement = document.querySelector('[data-arcade-message]');
  messageElement.textContent = message;
  messageElement.classList.toggle('arcade-message-win', arcadeState.finished);
}

function updateCardReadout() {
  const bits = [...document.querySelectorAll('[data-bit-index]')]
    .sort((left, right) => Number(left.dataset.bitIndex) - Number(right.dataset.bitIndex))
    .map(button => button.getAttribute('aria-pressed') === 'true' ? '1' : '0')
    .join('');
  const value = Number.parseInt(bits, 2);
  const character = value >= 32 && value <= 126 ? String.fromCharCode(value) : '·';
  document.querySelector('[data-card-result]').textContent = character;
  document.querySelector('[data-card-code]').textContent = `${bits} / DECIMAL ${value}`;
}

function renderStory(nodeName, trail) {
  const node = storyNodes[nodeName];
  document.querySelector('[data-story-label]').textContent = node.label;
  document.querySelector('[data-story-title]').textContent = node.title;
  document.querySelector('[data-story-copy]').textContent = node.copy;
  document.querySelector('[data-story-trail]').textContent = `TRAIL: ${trail.length ? trail.join(' > ') : 'NONE'}`;
  const buttons = [...document.querySelectorAll('[data-story-choice]')];
  buttons.forEach((button, index) => {
    const choice = node.choices[index];
    button.hidden = !choice;
    if (choice) {
      button.dataset.storyChoice = choice[0];
      button.textContent = choice[1];
    }
  });
}

function updatePacketStatus(message) {
  document.querySelector('[data-packet-status]').textContent = message;
  document.querySelector('[data-packet-trace]').textContent = `TRACE: ${packetState.path.join(' → ')}`;
  document.querySelectorAll('[data-packet-node]').forEach(button => {
    button.classList.toggle('current-node', button.dataset.packetNode === packetState.path.at(-1));
  });
}

function renderHomepage() {
  const title = document.querySelector('#homepage-title').value.trim() || 'Untitled Home Page';
  const intro = document.querySelector('#homepage-intro').value.trim() || 'Welcome to my little corner of the web.';
  const preview = document.querySelector('[data-home-preview]');
  const activeTheme = document.querySelector('[data-home-theme][aria-pressed="true"]');
  document.querySelector('[data-preview-title]').textContent = title;
  document.querySelector('[data-preview-copy]').textContent = intro;
  document.querySelector('[data-preview-counter]').hidden = !document.querySelector('#homepage-counter').checked;
  document.querySelector('[data-preview-marquee]').hidden = !document.querySelector('#homepage-marquee').checked;
  preview.dataset.theme = activeTheme ? activeTheme.dataset.homeTheme : 'blue';
}

function handleEraAction(action, button) {
  if (action === 'follow') {
    const following = button.dataset.following !== 'true';
    button.dataset.following = String(following);
    button.textContent = following ? 'FOLLOWING' : 'FOLLOW';
  }
  if (action === 'arcade-reset') {
    arcadeState.position = 0;
    arcadeState.score = 0;
    arcadeState.finished = false;
    renderArcade('Ready, player one? Run to move. Jump to clear gaps.');
  }
  if (action === 'arcade-run' || action === 'arcade-jump') {
    if (arcadeState.finished) return;
    let next = arcadeState.position + 1;
    if (action === 'arcade-jump') {
      next = arcadeState.position + 2;
      if ([2, 6].includes(next)) next++;
    }
    const gapHit = action === 'arcade-run' && [2, 6].includes(next);
    if (gapHit) {
      arcadeState.position = 0;
      arcadeState.score = 0;
      renderArcade('Gap! Back to the start. Jump across the broken tiles.');
      return;
    }
    arcadeState.position = Math.min(next, 9);
    arcadeState.score += 10;
    arcadeState.finished = arcadeState.position === 9;
    renderArcade(arcadeState.finished ? 'COURSE CLEAR! New game to run it again.' : 'Nice run. Keep moving.');
  }
  if (action === 'packet-reset') {
    packetState.path = ['A'];
    packetState.finished = false;
    updatePacketStatus('READY AT NODE A');
  }
  if (action === 'read-card') updateCardReadout();
  if (action === 'encode-message') {
    const message = document.querySelector('#rotor-message').value.toUpperCase();
    const shift = Math.max(1, Math.min(25, Number(document.querySelector('#rotor-shift').value) || 1));
    document.querySelector('[data-rotor-output]').textContent = [...message].map(character => {
      if (character < 'A' || character > 'Z') return character;
      return String.fromCharCode((character.charCodeAt(0) - 65 + shift) % 26 + 65);
    }).join('');
  }
}

document.addEventListener('submit', event => {
  const form = event.target.closest('[data-era-form]');
  if (!form) return;
  event.preventDefault();
  if (form.dataset.eraForm === 'post') {
    const textarea = form.querySelector('textarea');
    const message = textarea.value.trim();
    if (!message) return;
    const post = document.createElement('article');
    post.className = 'status-post';
    const author = document.createElement('b');
    author.textContent = 'juniper.wav';
    const time = document.createElement('time');
    time.textContent = 'just now';
    const copy = document.createElement('p');
    copy.textContent = message;
    const actions = document.createElement('span');
    actions.textContent = '♡ 00　 ↗ share';
    post.append(author, time, copy, actions);
    document.querySelector('[data-status-feed]').prepend(post);
    textarea.value = '';
  }
  if (form.dataset.eraForm === 'bbs') {
    const input = form.querySelector('input');
    const command = input.value.trim().toLowerCase();
    const output = document.querySelector('[data-bbs-output]');
    let phase = Number(form.dataset.phase || 0);
    let response;
    if (command === 'help') response = 'Commands: SCAN, TUNE 88.4, OPEN, HELP.';
    else if (command === 'scan') {
      phase = 1;
      response = 'Carrier detected. Board frequency: 88.4 MHz.';
    } else if (command === 'tune 88.4' && phase >= 1) {
      phase = 2;
      response = 'Frequency locked at 88.4 MHz. Type OPEN to connect.';
    } else if (command === 'open' && phase === 2) {
      phase = 3;
      response = 'CONNECTION ESTABLISHED. Welcome to the Night Terminal message board.';
    } else response = 'No carrier. Try HELP, or follow the scan / tune / open sequence.';
    form.dataset.phase = String(phase);
    output.textContent = response;
    input.value = '';
  }
});

document.addEventListener('click', event => {
  const actionButton = event.target.closest('[data-era-action]');
  if (actionButton) handleEraAction(actionButton.dataset.eraAction, actionButton);

  const themeButton = event.target.closest('[data-home-theme]');
  if (themeButton) {
    document.querySelectorAll('[data-home-theme]').forEach(button => {
      const active = button === themeButton;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    renderHomepage();
  }
  if (event.target.closest('[data-era-action="homepage-reset"]')) {
    document.querySelector('#homepage-title').value = "Mira's Home Page";
    document.querySelector('#homepage-intro').value = 'Moon sketches, mailing-list finds, and notes from late-night browsing.';
    document.querySelector('#homepage-counter').checked = true;
    document.querySelector('#homepage-marquee').checked = true;
    document.querySelectorAll('[data-home-theme]').forEach(button => {
      const active = button.dataset.homeTheme === 'blue';
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    document.querySelector('[data-builder-status]').textContent = 'Page settings reset.';
    renderHomepage();
  }

  const nodeButton = event.target.closest('[data-packet-node]');
  if (nodeButton && !packetState.finished) {
    const current = packetState.path.at(-1);
    const next = nodeButton.dataset.packetNode;
    const expected = ['C', 'E', 'F'][packetState.path.length - 1];
    if (next === expected) {
      packetState.path.push(next);
      packetState.finished = next === 'F';
      updatePacketStatus(packetState.finished ? 'MESSAGE DELIVERED TO NODE F' : `PACKET FORWARDED TO NODE ${next}`);
    } else {
      packetState.path = ['A'];
      updatePacketStatus(`ROUTE LOST AT ${current}. PACKET RETURNED TO A.`);
    }
  }

  const storyChoice = event.target.closest('[data-story-choice]');
  if (storyChoice) {
    const choice = storyChoice.dataset.storyChoice;
    if (choice === 'index') renderStory('root', []);
    else {
      const currentTrail = document.querySelector('[data-story-trail]').textContent.replace('TRAIL: ', '').split(' > ').filter(item => item !== 'NONE');
      currentTrail.push(storyChoice.textContent.replace(/\s*→$/, ''));
      renderStory(choice, currentTrail);
    }
  }

  const bitButton = event.target.closest('[data-bit-index]');
  if (bitButton) {
    const punched = bitButton.getAttribute('aria-pressed') !== 'true';
    bitButton.setAttribute('aria-pressed', String(punched));
    bitButton.textContent = punched ? '1' : '0';
    updateCardReadout();
  }
});

document.addEventListener('input', event => {
  if (event.target.closest('[data-homepage-builder]')) {
    document.querySelector('[data-builder-status]').textContent = 'Preview updated.';
    renderHomepage();
  }
});

document.addEventListener('DOMContentLoaded', () => {
  renderArcade('Ready, player one? Run to move. Jump to clear gaps.');
  updateCardReadout();
  updatePacketStatus('READY AT NODE A');
  renderStory('root', []);
  renderHomepage();
});
