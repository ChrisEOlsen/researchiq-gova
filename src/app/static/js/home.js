import { get, post } from '/static/js/lib/api.js';
import { initNav } from '/static/js/lib/nav.js';

const app = document.getElementById('app');

// Same 5 example questions as the production app.
const EXAMPLE_QUESTIONS = [
  'Are bluetooth headphones really bad for your brain?',
  'Is fluoride in drinking water bad for your health?',
  'Do egg yolks increase LDL cholesterol?',
  'Does sauna improve heart health?',
  'Is chiropractic care a pseudo science?',
];

const HOW_IT_WORKS_STEPS = [
  ['You ask a health question', '— anything from diet and supplements to medications and conditions.'],
  ['We search PubMed', '— the U.S. National Library of Medicine database of over 36 million peer-reviewed biomedical studies.'],
  ['AI reads and synthesizes the studies', '— summarizing the actual findings in plain language, noting where evidence is strong or mixed.'],
  ['You get a cited summary', '— every claim links back to the original paper so you can verify it yourself.'],
];

let textarea;
let submitBtn;
let errorMsg;

function renderHero(wrapper) {
  const hero = document.createElement('div');
  hero.className = 'text-center space-y-3 mb-10';
  const h1 = document.createElement('h1');
  h1.className = 'font-display text-[2.25rem] font-semibold text-text leading-tight';
  h1.textContent = 'What does the science say?';
  const tagline = document.createElement('p');
  tagline.className = 'text-text-muted text-[0.9375rem] leading-relaxed max-w-[480px] mx-auto';
  tagline.append('Ask any health question — ResearchIQ searches ');
  const strong = document.createElement('strong');
  strong.className = 'text-text font-medium';
  strong.textContent = 'PubMed';
  tagline.append(strong, ", the world's largest database of peer-reviewed studies, and uses AI to summarize what the research actually says, with cited sources.");
  hero.append(h1, tagline);
  wrapper.appendChild(hero);
}

function renderGuestExhaustedGate(wrapper) {
  const card = document.createElement('div');
  card.className = 'bg-surface border border-border rounded-lg px-6 py-8 text-center';

  const title = document.createElement('p');
  title.className = 'text-base font-medium text-text mb-2';
  title.textContent = "You've used all 5 free credits";
  const body = document.createElement('p');
  body.className = 'text-sm text-text-muted mb-6 leading-relaxed';
  body.textContent = 'Create a free account to purchase more research credits.';

  const createBtn = document.createElement('a');
  createBtn.href = '/register';
  createBtn.className = 'inline-block bg-primary hover:bg-primary-hover text-white rounded-lg px-8 py-3 text-[0.9375rem] font-semibold no-underline transition-colors';
  createBtn.textContent = 'Create Account';

  const signInRow = document.createElement('p');
  signInRow.className = 'text-[0.8125rem] text-text-muted mt-4';
  signInRow.append('Already have an account? ');
  const signInLink = document.createElement('a');
  signInLink.href = '/login';
  signInLink.className = 'text-primary no-underline';
  signInLink.textContent = 'Sign in';
  signInRow.appendChild(signInLink);

  card.append(title, body, createBtn, signInRow);
  wrapper.appendChild(card);
}

function renderLowCreditBanner(wrapper) {
  const banner = document.createElement('div');
  banner.className = 'bg-surface border border-border rounded-lg px-4 py-3.5 mb-5 flex items-center justify-between gap-4';
  const text = document.createElement('p');
  text.className = 'text-sm text-text-muted m-0';
  text.textContent = 'You have no credits remaining.';
  const buyBtn = document.createElement('a');
  buyBtn.href = '/settings';
  buyBtn.className = 'shrink-0 bg-primary hover:bg-primary-hover text-white rounded-md px-4 py-2 text-sm font-medium no-underline transition-colors';
  buyBtn.textContent = 'Buy more credits';
  banner.append(text, buyBtn);
  wrapper.appendChild(banner);
}

function renderForm(wrapper, isAuthed) {
  errorMsg = document.createElement('div');
  errorMsg.className = 'hidden border border-red-200 bg-red-50 text-red-700 text-sm px-4 py-3 rounded mb-3';
  wrapper.appendChild(errorMsg);

  const form = document.createElement('form');

  textarea = document.createElement('textarea');
  textarea.name = 'question';
  textarea.rows = 4;
  textarea.required = true;
  textarea.minLength = 10;
  textarea.placeholder = 'Write your question to trigger research...';
  textarea.className = 'block w-full bg-surface border border-border rounded-lg px-4 py-3.5 text-[0.9375rem] text-text resize-none mb-3 transition-colors focus:outline-none focus:border-primary';

  submitBtn = document.createElement('button');
  submitBtn.type = 'submit';
  submitBtn.className = 'w-full bg-primary hover:bg-primary-hover text-white rounded-lg px-6 py-3 text-[0.9375rem] font-semibold transition-colors';
  submitBtn.textContent = 'Research';

  form.append(textarea, submitBtn);
  form.addEventListener('submit', onSubmit);

  if (!isAuthed) {
    const loginHint = document.createElement('p');
    loginHint.className = 'text-center text-[0.8125rem] text-text-muted mt-2.5';
    loginHint.append('Log in to save your results to your account. ');
    const loginLink = document.createElement('a');
    loginLink.href = '/login';
    loginLink.className = 'text-primary font-medium no-underline';
    loginLink.textContent = 'Sign In';
    loginHint.appendChild(loginLink);
    form.appendChild(loginHint);
  }

  wrapper.appendChild(form);

  const chips = document.createElement('div');
  chips.className = 'mt-4 flex flex-col gap-2 items-start';
  EXAMPLE_QUESTIONS.forEach((q) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'inline-block w-fit bg-surface border border-border rounded-full px-3.5 py-1.5 text-[0.8125rem] text-text-muted hover:border-primary hover:text-primary transition-colors text-left';
    chip.textContent = q;
    chip.addEventListener('click', () => {
      textarea.value = q;
      textarea.focus();
    });
    chips.appendChild(chip);
  });
  wrapper.appendChild(chips);
}

function renderHowItWorks() {
  const container = document.createElement('div');
  container.className = 'fixed bottom-5 right-5 z-[100]';

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.title = 'What does ResearchIQ do?';
  trigger.className = 'flex items-center gap-1.5 bg-surface border border-border rounded-full px-3 py-1.5 text-[0.8125rem] text-text-muted shadow-sm hover:border-primary hover:text-primary transition-colors';

  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  icon.setAttribute('width', '13');
  icon.setAttribute('height', '13');
  icon.setAttribute('viewBox', '0 0 24 24');
  icon.setAttribute('fill', 'none');
  icon.setAttribute('stroke', 'currentColor');
  icon.setAttribute('stroke-width', '2.5');
  icon.setAttribute('stroke-linecap', 'round');
  icon.setAttribute('stroke-linejoin', 'round');
  const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  circle.setAttribute('cx', '12');
  circle.setAttribute('cy', '12');
  circle.setAttribute('r', '10');
  const qPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  qPath.setAttribute('d', 'M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3');
  const dot = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  dot.setAttribute('x1', '12'); dot.setAttribute('y1', '17'); dot.setAttribute('x2', '12.01'); dot.setAttribute('y2', '17');
  icon.append(circle, qPath, dot);
  trigger.append(icon, document.createTextNode(' How it works'));

  const backdrop = document.createElement('div');
  backdrop.className = 'hidden fixed inset-0 bg-black/35 flex items-center justify-center p-4 z-[200]';

  const modal = document.createElement('div');
  modal.className = 'bg-surface border border-border rounded-xl px-7 py-8 max-w-[440px] w-full shadow-xl';

  const modalHead = document.createElement('div');
  modalHead.className = 'flex items-start justify-between mb-5';
  const modalTitle = document.createElement('h2');
  modalTitle.className = 'font-display text-xl font-semibold text-text m-0';
  modalTitle.textContent = 'What does ResearchIQ do?';
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'bg-transparent border-0 cursor-pointer text-text-muted p-0 ml-4 shrink-0';
  closeBtn.setAttribute('aria-label', 'Close');
  const closeIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  closeIcon.setAttribute('width', '18');
  closeIcon.setAttribute('height', '18');
  closeIcon.setAttribute('viewBox', '0 0 24 24');
  closeIcon.setAttribute('fill', 'none');
  closeIcon.setAttribute('stroke', 'currentColor');
  closeIcon.setAttribute('stroke-width', '2');
  closeIcon.setAttribute('stroke-linecap', 'round');
  const l1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  l1.setAttribute('x1', '18'); l1.setAttribute('y1', '6'); l1.setAttribute('x2', '6'); l1.setAttribute('y2', '18');
  const l2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  l2.setAttribute('x1', '6'); l2.setAttribute('y1', '6'); l2.setAttribute('x2', '18'); l2.setAttribute('y2', '18');
  closeIcon.append(l1, l2);
  closeBtn.appendChild(closeIcon);
  modalHead.append(modalTitle, closeBtn);

  const ol = document.createElement('ol');
  ol.className = 'm-0 pl-5 flex flex-col gap-3.5 text-text-muted text-[0.9rem] leading-relaxed';
  HOW_IT_WORKS_STEPS.forEach(([lead, rest]) => {
    const li = document.createElement('li');
    const strong = document.createElement('strong');
    strong.className = 'text-text font-medium';
    strong.textContent = lead;
    li.append(strong, ` ${rest}`);
    ol.appendChild(li);
  });

  const footer = document.createElement('p');
  footer.className = 'mt-5 text-[0.8125rem] text-text-muted leading-snug';
  footer.textContent = 'No opinions. No anecdotes. Just what peer-reviewed science actually says.';

  modal.append(modalHead, ol, footer);
  backdrop.appendChild(modal);

  function open() {
    backdrop.classList.remove('hidden');
  }
  function close() {
    backdrop.classList.add('hidden');
  }
  trigger.addEventListener('click', open);
  closeBtn.addEventListener('click', close);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });

  container.append(trigger, backdrop);
  document.body.appendChild(container);
}

async function loadState() {
  const me = await get('/api/auth/me');
  if (me.ok) {
    return { isAuthed: true, credits: me.data.credits ?? 0, lifetimeAccess: !!me.data.lifetime_access };
  }
  const hist = await get('/api/research_history');
  const doneCount = hist.ok ? (hist.data?.jobs ?? []).filter((j) => j.status === 'done').length : 0;
  return { isAuthed: false, guestCreditsLeft: Math.max(0, 5 - doneCount) };
}

async function render() {
  const wrapper = document.createElement('div');
  wrapper.className = 'max-w-[640px] mx-auto w-full px-4 py-12 animate-fade-in';

  const state = await loadState();
  renderHero(wrapper);

  if (!state.isAuthed && state.guestCreditsLeft <= 0) {
    renderGuestExhaustedGate(wrapper);
  } else {
    if (state.isAuthed && !state.lifetimeAccess && state.credits <= 0) {
      renderLowCreditBanner(wrapper);
    }
    renderForm(wrapper, state.isAuthed);
  }

  app.className = '';
  app.replaceChildren(wrapper);
}

function setSubmitting(isSubmitting) {
  submitBtn.disabled = isSubmitting;
  submitBtn.replaceChildren();
  submitBtn.textContent = isSubmitting ? 'Searching…' : 'Research';
}

async function onSubmit(e) {
  e.preventDefault();
  errorMsg.classList.add('hidden');

  const question = textarea.value.trim();
  if (question.length < 10) {
    errorMsg.textContent = 'Question must be at least 10 characters.';
    errorMsg.classList.remove('hidden');
    return;
  }

  setSubmitting(true);
  const res = await post('/api/research_submit', { question });

  if (res.ok) {
    window.location.href = '/history';
    return;
  }

  setSubmitting(false);
  errorMsg.textContent = res.error ?? 'Something went wrong. Please try again.';
  errorMsg.classList.remove('hidden');
}

initNav();
render();
renderHowItWorks();
