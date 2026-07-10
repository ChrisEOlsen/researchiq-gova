import { get, post } from '/static/js/lib/api.js';
import { initNav } from '/static/js/lib/nav.js';

const app = document.getElementById('app');

// Same 5 example questions as the production app, tagged with the
// research field each one falls under (shown in the index list).
const EXAMPLE_QUESTIONS = [
  ['Neurology', 'Are bluetooth headphones really bad for your brain?'],
  ['Public health', 'Is fluoride in drinking water bad for your health?'],
  ['Nutrition', 'Do egg yolks increase LDL cholesterol?'],
  ['Cardiology', 'Does sauna improve heart health?'],
  ['Musculoskeletal', 'Is chiropractic care a pseudo science?'],
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
  hero.className = 'mb-10';

  const eyebrow = document.createElement('p');
  eyebrow.className = 'font-metric text-[0.6875rem] tracking-[0.18em] uppercase text-ink-soft mb-5';
  eyebrow.textContent = 'Evidence engine · 36M peer-reviewed studies';

  const h1 = document.createElement('h1');
  h1.className = 'font-journal font-light text-[2.25rem] sm:text-[2.75rem] leading-[1.12] text-ink';
  h1.append('What does ');
  const marked = document.createElement('span');
  marked.className = 'hl-mark font-medium';
  marked.textContent = 'the science';
  h1.append(marked, ' say?');

  const tagline = document.createElement('p');
  tagline.className = 'text-ink-soft text-[0.9375rem] leading-relaxed max-w-[520px] mt-4';
  tagline.append('Ask any health question. ResearchIQ reads the peer-reviewed literature on ');
  const strong = document.createElement('strong');
  strong.className = 'text-ink font-medium';
  strong.textContent = 'PubMed';
  tagline.append(strong, ' and returns a plain-language summary — every claim cited back to the original paper.');

  hero.append(eyebrow, h1, tagline);
  wrapper.appendChild(hero);
}

function renderGuestExhaustedGate(wrapper) {
  const card = document.createElement('div');
  card.className = 'bg-white border border-rule rounded-xl px-6 py-8 text-center';

  const title = document.createElement('p');
  title.className = 'font-journal text-lg font-medium text-ink mb-2';
  title.textContent = "You've used all 5 free credits";
  const body = document.createElement('p');
  body.className = 'text-sm text-ink-soft mb-6 leading-relaxed';
  body.textContent = 'Create a free account to purchase more research credits.';

  const createBtn = document.createElement('a');
  createBtn.href = '/register';
  createBtn.className = 'inline-block bg-ink hover:bg-[#1d4750] text-paper rounded-lg px-8 py-3 text-[0.9375rem] font-medium no-underline transition-colors';
  createBtn.textContent = 'Create Account';

  const signInRow = document.createElement('p');
  signInRow.className = 'text-[0.8125rem] text-ink-soft mt-4';
  signInRow.append('Already have an account? ');
  const signInLink = document.createElement('a');
  signInLink.href = '/login';
  signInLink.className = 'text-accent no-underline';
  signInLink.textContent = 'Sign in';
  signInRow.appendChild(signInLink);

  card.append(title, body, createBtn, signInRow);
  wrapper.appendChild(card);
}

function renderLowCreditBanner(wrapper) {
  const banner = document.createElement('div');
  banner.className = 'bg-white border border-rule rounded-xl px-4 py-3.5 mb-5 flex items-center justify-between gap-4';
  const text = document.createElement('p');
  text.className = 'text-sm text-ink-soft m-0';
  text.textContent = 'You have no credits remaining.';
  const buyBtn = document.createElement('a');
  buyBtn.href = '/settings';
  buyBtn.className = 'shrink-0 bg-ink hover:bg-[#1d4750] text-paper rounded-md px-4 py-2 text-sm font-medium no-underline transition-colors';
  buyBtn.textContent = 'Buy more credits';
  banner.append(text, buyBtn);
  wrapper.appendChild(banner);
}

function renderForm(wrapper, isAuthed) {
  errorMsg = document.createElement('div');
  errorMsg.className = 'hidden border border-red-200 bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg mb-3';
  wrapper.appendChild(errorMsg);

  const form = document.createElement('form');

  // Query card: borderless textarea + a metadata footer row, framed as
  // one white "record" on the paper background.
  const card = document.createElement('div');
  card.className = 'bg-white border border-rule rounded-xl shadow-[0_1px_2px_rgba(20,51,60,0.05)] transition-colors focus-within:border-ink/50';

  textarea = document.createElement('textarea');
  textarea.name = 'question';
  textarea.rows = 4;
  textarea.required = true;
  textarea.minLength = 10;
  textarea.placeholder = 'Ask a health question…';
  textarea.className = 'block w-full bg-transparent px-4 pt-4 pb-2 text-[0.9375rem] text-ink placeholder:text-ink-soft/70 resize-none focus:outline-none';

  const footerRow = document.createElement('div');
  footerRow.className = 'flex items-center justify-between gap-4 border-t border-rule px-4 py-3';

  const meta = document.createElement('span');
  meta.className = 'font-metric text-[0.625rem] tracking-[0.16em] uppercase text-ink-soft';
  meta.textContent = 'PubMed · cited sources';

  submitBtn = document.createElement('button');
  submitBtn.type = 'submit';
  submitBtn.className = 'shrink-0 bg-ink hover:bg-[#1d4750] text-paper rounded-lg px-6 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mark';
  submitBtn.textContent = 'Research';

  footerRow.append(meta, submitBtn);
  card.append(textarea, footerRow);
  form.appendChild(card);
  form.addEventListener('submit', onSubmit);

  if (!isAuthed) {
    const loginHint = document.createElement('p');
    loginHint.className = 'text-[0.8125rem] text-ink-soft mt-3';
    loginHint.append('Log in to save your results to your account. ');
    const loginLink = document.createElement('a');
    loginLink.href = '/login';
    loginLink.className = 'text-accent font-medium no-underline';
    loginLink.textContent = 'Sign In';
    loginHint.appendChild(loginLink);
    form.appendChild(loginHint);
  }

  wrapper.appendChild(form);

  // Example questions as an evidence index: ruled rows with a mono
  // field tag, rather than pill chips.
  const index = document.createElement('div');
  index.className = 'mt-12';

  const indexLabel = document.createElement('p');
  indexLabel.className = 'font-metric text-[0.625rem] tracking-[0.18em] uppercase text-ink-soft mb-1';
  indexLabel.textContent = 'Or start from the index';
  index.appendChild(indexLabel);

  EXAMPLE_QUESTIONS.forEach(([field, q]) => {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'group w-full flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-4 border-t border-rule py-3 text-left last:border-b';

    const tag = document.createElement('span');
    tag.className = 'font-metric text-[0.625rem] tracking-[0.12em] uppercase text-ink-soft sm:w-[118px] shrink-0';
    tag.textContent = field;

    const question = document.createElement('span');
    question.className = 'text-[0.9375rem] text-ink group-hover:text-accent transition-colors';
    question.textContent = q;

    const arrow = document.createElement('span');
    arrow.className = 'hidden sm:inline ml-auto shrink-0 self-center text-accent opacity-0 group-hover:opacity-100 transition-opacity';
    arrow.textContent = '→';
    arrow.setAttribute('aria-hidden', 'true');

    row.append(tag, question, arrow);
    row.addEventListener('click', () => {
      textarea.value = q;
      textarea.focus();
    });
    index.appendChild(row);
  });
  wrapper.appendChild(index);
}

function renderHowItWorks() {
  const container = document.createElement('div');
  container.className = 'fixed bottom-5 right-5 z-[100]';

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.title = 'What does ResearchIQ do?';
  trigger.className = 'flex items-center gap-1.5 bg-white border border-rule rounded-full px-3 py-1.5 text-[0.8125rem] text-ink-soft shadow-sm hover:border-ink hover:text-ink transition-colors';

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
  backdrop.className = 'hidden fixed inset-0 bg-ink/30 flex items-center justify-center p-4 z-[200]';

  const modal = document.createElement('div');
  modal.className = 'bg-white border border-rule rounded-xl px-7 py-8 max-w-[440px] w-full shadow-xl';

  const modalHead = document.createElement('div');
  modalHead.className = 'flex items-start justify-between mb-5';
  const modalTitle = document.createElement('h2');
  modalTitle.className = 'font-journal text-xl font-medium text-ink m-0';
  modalTitle.textContent = 'What does ResearchIQ do?';
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'bg-transparent border-0 cursor-pointer text-ink-soft p-0 ml-4 shrink-0';
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
  ol.className = 'm-0 pl-5 flex flex-col gap-3.5 text-ink-soft text-[0.9rem] leading-relaxed marker:font-metric marker:text-[0.75rem] marker:text-ink-soft';
  HOW_IT_WORKS_STEPS.forEach(([lead, rest]) => {
    const li = document.createElement('li');
    const strong = document.createElement('strong');
    strong.className = 'text-ink font-medium';
    strong.textContent = lead;
    li.append(strong, ` ${rest}`);
    ol.appendChild(li);
  });

  const footer = document.createElement('p');
  footer.className = 'mt-5 font-journal italic text-[0.9375rem] text-ink-soft leading-snug';
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
  wrapper.className = 'max-w-[660px] mx-auto w-full px-4 py-14 animate-fade-in';

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
