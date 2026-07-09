import { post } from '/static/js/lib/api.js';

const app = document.getElementById('app');

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
  wrapper.className = 'py-12 space-y-8';

  const hero = document.createElement('div');
  hero.className = 'text-center space-y-3';
  const h1 = document.createElement('h1');
  h1.className = 'text-4xl font-bold tracking-tight text-gray-900';
  h1.textContent = 'Ask ResearchIQ';
  const tagline = document.createElement('p');
  tagline.className = 'text-gray-500 text-lg';
  tagline.textContent = 'Get a plain-language summary of the peer-reviewed evidence.';
  hero.append(h1, tagline);

  const card = document.createElement('div');
  card.className = 'bg-white border border-gray-200 rounded-lg p-6 space-y-4 max-w-2xl mx-auto';

  errorMsg = document.createElement('div');
  errorMsg.className = 'hidden border border-red-200 bg-red-50 text-red-700 text-sm px-4 py-3 rounded';
  card.appendChild(errorMsg);

  const form = document.createElement('form');
  form.className = 'space-y-4';

  const label = document.createElement('label');
  label.className = 'block text-sm font-medium text-gray-700 mb-1';
  label.setAttribute('for', 'question');
  label.textContent = 'Your health question';

  textarea = document.createElement('textarea');
  textarea.id = 'question';
  textarea.name = 'question';
  textarea.rows = 4;
  textarea.required = true;
  textarea.minLength = 10;
  textarea.placeholder = 'e.g. Is intermittent fasting good for weight loss?';
  textarea.className = 'block w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-900';

  const chipsLabel = document.createElement('p');
  chipsLabel.className = 'text-xs text-gray-500';
  chipsLabel.textContent = 'Or try one of these:';

  const chipsWrap = document.createElement('div');
  chipsWrap.className = 'flex flex-wrap gap-2';
  EXAMPLE_QUESTIONS.forEach((q) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'text-xs border border-gray-200 rounded px-3 py-1.5 text-gray-600 hover:bg-gray-100 transition-colors';
    chip.textContent = q;
    chip.addEventListener('click', () => {
      textarea.value = q;
      textarea.focus();
    });
    chipsWrap.appendChild(chip);
  });

  submitBtn = document.createElement('button');
  submitBtn.type = 'submit';
  submitBtn.className = 'w-full px-4 py-2 bg-gray-900 text-white text-sm rounded hover:bg-gray-700 transition-colors';
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
    spinner.className = 'spinner';
    submitBtn.appendChild(spinner);
    submitBtn.appendChild(document.createTextNode(' Starting…'));
  } else {
    submitBtn.textContent = 'Start research';
  }
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

render();
