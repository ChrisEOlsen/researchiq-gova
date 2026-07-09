import { get } from '/static/js/lib/api.js';

const app = document.getElementById('app');
const params = new URLSearchParams(window.location.search);
const shareToken = params.get('t');

async function init() {
  if (!shareToken) {
    renderError('Missing share link.');
    return;
  }
  const res = await get(`/api/research_result?t=${encodeURIComponent(shareToken)}`);
  if (!res.ok) {
    renderError(res.error ?? 'This shared research could not be found.');
    return;
  }
  render(res.data);
}

function renderError(msg) {
  const p = document.createElement('p');
  p.className = 'text-sm text-red-600';
  p.textContent = msg;
  app.replaceChildren(p);
}

function makeSection(heading) {
  const section = document.createElement('div');
  const h2 = document.createElement('h2');
  h2.className = 'text-sm font-semibold text-gray-900 mb-2';
  h2.textContent = heading;
  section.appendChild(h2);
  return section;
}

function render(data) {
  const job = data.job ?? {};
  const summary = data.summary ?? '';
  const keyTakeaways = Array.isArray(data.key_takeaways) ? data.key_takeaways : [];
  const followUpQuestions = Array.isArray(data.follow_up_questions) ? data.follow_up_questions : [];
  const studies = Array.isArray(data.studies) ? data.studies : [];

  const wrapper = document.createElement('div');
  wrapper.className = 'space-y-6';

  const h1 = document.createElement('h1');
  h1.className = 'text-2xl font-semibold tracking-tight';
  h1.textContent = job.title || job.question || 'Shared Research';
  wrapper.appendChild(h1);

  if (job.question) {
    const question = document.createElement('p');
    question.className = 'text-sm text-gray-500';
    question.textContent = job.question;
    wrapper.appendChild(question);
  }

  const summaryCard = document.createElement('div');
  summaryCard.className = 'bg-white border border-gray-200 rounded-lg p-6';
  const summaryP = document.createElement('p');
  summaryP.className = 'text-sm text-gray-700 whitespace-pre-wrap';
  summaryP.textContent = summary;
  summaryCard.appendChild(summaryP);
  wrapper.appendChild(summaryCard);

  if (keyTakeaways.length > 0) {
    const section = makeSection('Key takeaways');
    const ul = document.createElement('ul');
    ul.className = 'space-y-1';
    keyTakeaways.forEach((t) => {
      const li = document.createElement('li');
      li.className = 'text-sm text-gray-700';
      li.textContent = `→ ${t}`;
      ul.appendChild(li);
    });
    section.appendChild(ul);
    wrapper.appendChild(section);
  }

  if (followUpQuestions.length > 0) {
    const section = makeSection('Follow-up questions');
    const qaList = document.createElement('div');
    qaList.className = 'space-y-3';
    followUpQuestions.forEach((qa) => {
      const block = document.createElement('div');
      const q = document.createElement('p');
      q.className = 'text-sm font-medium text-gray-900';
      q.textContent = qa.question ?? '';
      const a = document.createElement('p');
      a.className = 'text-sm text-gray-600';
      a.textContent = qa.answer ?? '';
      block.append(q, a);
      qaList.appendChild(block);
    });
    section.appendChild(qaList);
    wrapper.appendChild(section);
  }

  if (studies.length > 0) {
    const section = makeSection(`Studies (${studies.length})`);
    const list = document.createElement('div');
    list.className = 'space-y-2';
    studies.forEach((s) => {
      const item = document.createElement('div');
      item.className = 'text-sm border border-gray-100 rounded p-3';
      const link = document.createElement('a');
      link.href = s.url ?? '#';
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.className = 'text-blue-600 hover:underline font-medium';
      link.textContent = s.title ?? 'Untitled study';
      const meta = document.createElement('p');
      meta.className = 'text-xs text-gray-500 mt-1';
      meta.textContent = `${s.authors ?? ''} · ${s.journal ?? ''} · ${s.year ?? ''}`;
      item.append(link, meta);
      list.appendChild(item);
    });
    section.appendChild(list);
    wrapper.appendChild(section);
  }

  const actions = document.createElement('div');
  actions.className = 'flex flex-wrap items-center gap-3';

  const visualLink = document.createElement('a');
  visualLink.href = `/api/research_visual?share_token=${encodeURIComponent(shareToken)}`;
  visualLink.target = '_blank';
  visualLink.rel = 'noopener noreferrer';
  visualLink.className = 'text-sm text-blue-600 hover:underline';
  visualLink.textContent = 'Open visual explainer →';
  actions.appendChild(visualLink);

  const cta = document.createElement('a');
  cta.href = '/';
  cta.className = 'px-4 py-2 bg-gray-900 text-white text-sm rounded hover:bg-gray-700 transition-colors';
  cta.textContent = 'Try ResearchIQ free';
  actions.appendChild(cta);

  wrapper.appendChild(actions);

  app.replaceChildren(wrapper);
}

init();
