import { get } from '/static/js/lib/api.js';
import { initNav } from '/static/js/lib/nav.js';

const app = document.getElementById('app');
const params = new URLSearchParams(window.location.search);
const shareToken = params.get('t');

async function init() {
  initNav();

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

function setOgMeta(title, description) {
  const titleEl = document.querySelector('meta[property="og:title"]');
  if (titleEl && title) titleEl.setAttribute('content', title);
  const descEl = document.querySelector('meta[property="og:description"]');
  if (descEl && description) descEl.setAttribute('content', description);
}

function makeSection(heading) {
  const section = document.createElement('div');
  section.className = 'border-b border-border pb-6';
  const h2 = document.createElement('h2');
  h2.className = 'font-display text-lg font-semibold text-text mb-3';
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

  setOgMeta(job.title || job.question, summary.slice(0, 200));

  const wrapper = document.createElement('div');
  wrapper.className = 'space-y-6';

  const header = document.createElement('div');
  header.className = 'border-b border-border pb-6 space-y-2';
  const h1 = document.createElement('h1');
  h1.className = 'font-display text-3xl font-semibold text-text';
  h1.textContent = job.title || job.question || 'Shared Research';
  header.appendChild(h1);

  if (job.question) {
    const question = document.createElement('p');
    question.className = 'text-sm text-text-muted';
    question.textContent = job.question;
    header.appendChild(question);
  }
  wrapper.appendChild(header);

  const summarySection = document.createElement('div');
  summarySection.className = 'border-b border-border pb-6';
  const summaryCard = document.createElement('div');
  summaryCard.className = 'bg-surface border border-border rounded-lg p-6';
  const summaryP = document.createElement('p');
  summaryP.className = 'text-sm text-text whitespace-pre-wrap leading-relaxed';
  summaryP.textContent = summary;
  summaryCard.appendChild(summaryP);
  summarySection.appendChild(summaryCard);
  wrapper.appendChild(summarySection);

  if (keyTakeaways.length > 0) {
    const section = makeSection('Key takeaways');
    const ul = document.createElement('ul');
    ul.className = 'space-y-2';
    keyTakeaways.forEach((t) => {
      const li = document.createElement('li');
      li.className = 'text-sm text-text flex gap-2';
      const arrow = document.createElement('span');
      arrow.className = 'text-primary font-medium shrink-0';
      arrow.textContent = '→';
      const text = document.createElement('span');
      text.textContent = t;
      li.append(arrow, text);
      ul.appendChild(li);
    });
    section.appendChild(ul);
    wrapper.appendChild(section);
  }

  if (followUpQuestions.length > 0) {
    const section = makeSection('Follow-up questions');
    const qaList = document.createElement('div');
    qaList.className = 'space-y-4';
    followUpQuestions.forEach((qa) => {
      const block = document.createElement('div');
      const q = document.createElement('p');
      q.className = 'text-sm font-medium text-text';
      q.textContent = qa.question ?? '';
      const a = document.createElement('p');
      a.className = 'text-sm text-text-muted mt-1';
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
      item.className = 'text-sm bg-surface border border-border rounded-lg p-4';
      const link = document.createElement('a');
      link.href = s.url ?? '#';
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.className = 'text-text font-medium hover:text-primary transition-colors';
      link.textContent = s.title ?? 'Untitled study';
      const meta = document.createElement('p');
      meta.className = 'text-xs text-text-muted mt-1';
      meta.textContent = `${s.authors ?? ''} · ${s.journal ?? ''} · ${s.year ?? ''}`;
      item.append(link, meta);
      list.appendChild(item);
    });
    section.appendChild(list);
    wrapper.appendChild(section);
  }

  const visualCallout = document.createElement('div');
  visualCallout.className = 'border-l-4 border-primary bg-surface-2 rounded-r-lg p-4';
  const visualText = document.createElement('p');
  visualText.className = 'text-sm text-text-muted italic';
  visualText.textContent = 'Prefer a visual walkthrough? See the key findings laid out as an illustrated explainer.';
  const visualLink = document.createElement('a');
  visualLink.href = `/api/research_visual?share_token=${encodeURIComponent(shareToken)}`;
  visualLink.target = '_blank';
  visualLink.rel = 'noopener noreferrer';
  visualLink.className = 'inline-block mt-2 text-sm font-medium text-primary hover:text-primary-hover not-italic';
  visualLink.textContent = 'Open visual explainer →';
  visualCallout.append(visualText, visualLink);
  wrapper.appendChild(visualCallout);

  const actions = document.createElement('div');
  actions.className = 'flex flex-wrap items-center gap-3';

  const cta = document.createElement('a');
  cta.href = '/';
  cta.className = 'px-4 py-2 bg-primary text-white text-sm font-medium rounded hover:bg-primary-hover transition-colors';
  cta.textContent = 'Try ResearchIQ free';
  actions.appendChild(cta);

  wrapper.appendChild(actions);

  app.replaceChildren(wrapper);
}

init();
