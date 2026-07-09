import { get, post } from '/static/js/lib/api.js';
import { initNav } from '/static/js/lib/nav.js';

const app = document.getElementById('app');
let creditBanner;
let submitDisabledByCredits = false;

const EXAMPLE_QUESTIONS = [
  'Is intermittent fasting effective for weight loss?',
  'Does creatine supplementation improve muscle strength?',
  'Can meditation reduce symptoms of anxiety?',
  'Is a low-carb diet better for blood sugar control than a low-fat diet?',
  'Does cold exposure therapy boost the immune system?',
];

let textarea;
let submitBtn;
let errorMsg;

function render() {
  const wrapper = document.createElement('div');
  wrapper.className = 'max-w-[640px] mx-auto py-12 space-y-8';

  const hero = document.createElement('div');
  hero.className = 'text-center space-y-3';
  const h1 = document.createElement('h1');
  h1.className = 'font-display text-4xl font-semibold text-text';
  h1.textContent = 'Ask ResearchIQ';
  const tagline = document.createElement('p');
  tagline.className = 'text-text-muted text-lg';
  tagline.textContent = 'Get a plain-language summary of the peer-reviewed evidence.';
  hero.append(h1, tagline);

  const card = document.createElement('div');
  card.className = 'bg-surface border border-border rounded-lg p-6 space-y-4';

  creditBanner = document.createElement('div');
  creditBanner.className = 'hidden border border-border bg-surface-2 text-text text-sm px-4 py-3 rounded';
  card.appendChild(creditBanner);

  errorMsg = document.createElement('div');
  errorMsg.className = 'hidden border border-red-200 bg-red-50 text-red-700 text-sm px-4 py-3 rounded';
  card.appendChild(errorMsg);

  const form = document.createElement('form');
  form.className = 'space-y-4';

  const label = document.createElement('label');
  label.className = 'block text-sm font-medium text-text mb-1';
  label.setAttribute('for', 'question');
  label.textContent = 'Your health question';

  textarea = document.createElement('textarea');
  textarea.id = 'question';
  textarea.name = 'question';
  textarea.rows = 4;
  textarea.required = true;
  textarea.minLength = 10;
  textarea.placeholder = 'e.g. Is intermittent fasting good for weight loss?';
  textarea.className = 'block w-full border border-border rounded px-3 py-2 text-sm text-text focus:outline-none focus:border-primary transition-colors';

  const chipsLabel = document.createElement('p');
  chipsLabel.className = 'text-xs text-text-muted';
  chipsLabel.textContent = 'Or try one of these:';

  const chipsWrap = document.createElement('div');
  chipsWrap.className = 'flex flex-wrap gap-2';
  EXAMPLE_QUESTIONS.forEach((q) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'text-xs border border-border rounded-full px-3 py-1.5 text-text-muted hover:bg-hover hover:border-primary hover:text-primary transition-colors';
    chip.textContent = q;
    chip.addEventListener('click', () => {
      textarea.value = q;
      textarea.focus();
    });
    chipsWrap.appendChild(chip);
  });

  submitBtn = document.createElement('button');
  submitBtn.type = 'submit';
  submitBtn.className = 'w-full px-4 py-2.5 bg-primary text-white text-sm font-medium rounded hover:bg-primary-hover transition-colors';
  submitBtn.textContent = 'Start research';

  form.append(label, textarea, chipsLabel, chipsWrap, submitBtn);
  form.addEventListener('submit', onSubmit);

  card.appendChild(form);
  wrapper.append(hero, card);
  app.replaceChildren(wrapper);
}

function setSubmitting(isSubmitting) {
  submitBtn.disabled = isSubmitting;
  submitBtn.replaceChildren();
  if (isSubmitting) {
    const spinner = document.createElement('span');
    spinner.className = 'inline-block w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin align-middle';
    submitBtn.appendChild(spinner);
    submitBtn.appendChild(document.createTextNode(' Starting…'));
  } else {
    submitBtn.textContent = 'Start research';
  }
}

function showCreditBanner(text, linkHref, linkText) {
  creditBanner.replaceChildren();
  creditBanner.appendChild(document.createTextNode(text + ' '));
  const link = document.createElement('a');
  link.href = linkHref;
  link.className = 'font-medium text-primary hover:text-primary-hover';
  link.textContent = linkText;
  creditBanner.appendChild(link);
  creditBanner.classList.remove('hidden');
  submitDisabledByCredits = true;
  submitBtn.disabled = true;
}

// Reads the caller's real credit/guest state and shows an accurate banner
// up front, rather than only surfacing a rejection after they submit —
// GOTHA had a bug here where the home page showed a hardcoded "5 credits"
// regardless of actual usage (SEED.md, Guest Mode section).
async function loadCreditState() {
  const me = await get('/api/auth/me');
  if (me.ok) {
    if (!me.data.lifetime_access && me.data.credits <= 0) {
      showCreditBanner("You're out of credits.", '/settings', 'Buy more credits →');
    }
    return;
  }

  const hist = await get('/api/research_history');
  if (!hist.ok) return;
  const doneCount = (hist.data?.jobs ?? []).filter((j) => j.status === 'done').length;
  if (doneCount >= 5) {
    showCreditBanner("You've used all 5 free guest questions.", '/register', 'Register for more →');
  }
}

async function onSubmit(e) {
  if (submitDisabledByCredits) {
    e.preventDefault();
    return;
  }
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
loadCreditState();
