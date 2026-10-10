const pages = [...document.querySelectorAll('.page')];
const navLinks = [...document.querySelectorAll('[data-route]')];
const backdrop = document.querySelector('#modal-backdrop');
const modals = [...document.querySelectorAll('.modal')];

function showPage(route) {
  const page = pages.find(item => item.dataset.page === route) || pages[0];
  pages.forEach(item => item.classList.toggle('active', item === page));
  navLinks.forEach(link => link.classList.toggle('active', link.dataset.route === page.dataset.page));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function openModal(id) {
  backdrop.hidden = false;
  modals.forEach(modal => modal.classList.toggle('open', modal.id === id));
  const input = document.querySelector(`#${id} input`);
  if (input) window.setTimeout(() => input.focus(), 50);
}

function closeModal() {
  backdrop.hidden = true;
  modals.forEach(modal => modal.classList.remove('open'));
}

window.addEventListener('hashchange', () => showPage(window.location.hash.slice(1) || 'home'));
document.addEventListener('click', event => {
  const route = event.target.closest('[data-route]');
  if (route) {
    event.preventDefault();
    window.location.hash = route.dataset.route;
    showPage(route.dataset.route);
  }
  const modalTrigger = event.target.closest('[data-modal]');
  if (modalTrigger) openModal(modalTrigger.dataset.modal);
  if (event.target.closest('.close-modal') || event.target === backdrop) closeModal();
  if (event.target.closest('.submit-modal')) {
    const button = event.target.closest('.submit-modal');
    button.innerHTML = 'SIGNAL RECEIVED <span>✓</span>';
    button.style.background = 'var(--green)';
    window.setTimeout(closeModal, 900);
  }
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape') closeModal();
});

const commandInput = document.querySelector('#terminal-command');
const terminalOutput = document.querySelector('.terminal-output');
if (commandInput) {
  commandInput.addEventListener('keydown', event => {
    if (event.key !== 'Enter') return;
    const command = commandInput.value.trim().toLowerCase();
    const responses = {
      help: 'available: work, archive, status, clear, exit',
      work: '07 projects found. routing to workshop...',
      archive: '04 files recovered. routing to archive...',
      status: 'all systems nominal. sleep module: not found.',
      clear: ''
    };
    if (command === 'exit') return closeModal();
    if (command === 'clear') terminalOutput.innerHTML = '';
    else terminalOutput.innerHTML += `<br /><span class="orange-text">guest@jw1:~$ ${command}</span><br />${responses[command] || 'command not found. try <b>help</b>.'}`;
    commandInput.value = '';
    if (command === 'work' || command === 'archive') {
      closeModal();
      window.location.hash = command;
      showPage(command);
    }
  });
}

showPage(window.location.hash.slice(1) || 'home');
