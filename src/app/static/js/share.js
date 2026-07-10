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
  app.className = '';
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

function displayTitle(job) {
  if (job.title) return job.title;
  return job.question && job.question.length > 80 ? job.question.slice(0, 80) : job.question;
}

function sectionHeading(text) {
  const h2 = document.createElement('h2');
  h2.className = 'font-display text-lg font-semibold text-text pb-2 border-b border-border mb-4';
  h2.textContent = text;
  return h2;
}

function studyCard(s) {
  const card = document.createElement('div');
  card.className = 'bg-surface border border-border rounded-lg px-4 py-3.5';
  const url = s.url || (s.pubmed_id ? `https://pubmed.ncbi.nlm.nih.gov/${s.pubmed_id}` : '');
  if (url) {
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.className = 'text-sm font-medium text-accent no-underline hover:underline block leading-snug';
    a.textContent = s.title || 'Untitled study';
    card.appendChild(a);
  } else {
    const p = document.createElement('p');
    p.className = 'text-sm font-medium text-text m-0 leading-snug';
    p.textContent = s.title || 'Untitled study';
    card.appendChild(p);
  }
  const meta = document.createElement('p');
  meta.className = 'text-xs text-text-muted mt-1';
  meta.textContent = [s.authors, s.journal, s.year].filter(Boolean).join(' · ');
  card.appendChild(meta);
  return card;
}

function renderVisualCallout(shareToken) {
  const callout = document.createElement('div');
  callout.className = 'flex items-center justify-between gap-4 bg-surface-2 border-l-[3px] border-primary rounded-r-md px-4 py-3 mb-10';
  const text = document.createElement('p');
  text.className = 'text-[0.8125rem] italic text-text-muted m-0 leading-snug';
  text.textContent = '✦ Visual explainer available — see the findings illustrated';
  const link = document.createElement('a');
  link.href = `/api/research_visual?share_token=${encodeURIComponent(shareToken)}`;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.className = 'inline-flex items-center gap-1.5 bg-primary hover:bg-primary-hover text-white rounded-md px-3.5 py-1.5 text-[0.8125rem] font-semibold no-underline whitespace-nowrap shrink-0 transition-colors';
  link.textContent = 'Open →';
  callout.append(text, link);
  return callout;
}

function render(data) {
  const job = data.job ?? {};
  const summary = data.summary ?? '';
  const keyTakeaways = Array.isArray(data.key_takeaways) ? data.key_takeaways : [];
  const followUpQuestions = Array.isArray(data.follow_up_questions) ? data.follow_up_questions : [];
  const studies = Array.isArray(data.studies) ? data.studies : [];
  const title = displayTitle(job);

  setOgMeta(title, summary.slice(0, 200));

  const wrapper = document.createElement('div');
  wrapper.className = 'animate-fade-in';

  const h1 = document.createElement('h1');
  h1.className = 'font-display text-[1.875rem] font-bold text-text leading-tight mb-1.5';
  h1.textContent = title;
  wrapper.appendChild(h1);

  if (job.title && job.question) {
    const question = document.createElement('p');
    question.className = 'text-[0.8125rem] text-text-muted italic mb-1 leading-snug';
    question.textContent = job.question;
    wrapper.appendChild(question);
  }

  const timestamp = document.createElement('p');
  timestamp.className = 'text-xs text-text-muted mb-6';
  timestamp.textContent = `Researched ${new Date(job.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
  wrapper.appendChild(timestamp);

  wrapper.appendChild(renderVisualCallout(shareToken));

  if (summary) {
    const section = document.createElement('section');
    section.className = 'mb-10';
    section.appendChild(sectionHeading('Summary'));
    const p = document.createElement('p');
    p.className = 'text-[0.9375rem] leading-[1.75] text-text whitespace-pre-wrap';
    p.textContent = summary;
    section.appendChild(p);
    wrapper.appendChild(section);
  }

  const takeawaysSection = document.createElement('section');
  takeawaysSection.className = 'mb-10';
  takeawaysSection.appendChild(sectionHeading('Key Takeaways'));
  if (keyTakeaways.length > 0) {
    const ul = document.createElement('ul');
    ul.className = 'flex flex-col gap-2.5 list-none p-0 m-0';
    keyTakeaways.forEach((t) => {
      const li = document.createElement('li');
      li.className = 'flex gap-3 text-[0.9375rem] text-text leading-relaxed';
      const arrow = document.createElement('span');
      arrow.className = 'text-accent shrink-0 mt-0.5';
      arrow.textContent = '→';
      const text = document.createElement('span');
      text.textContent = t;
      li.append(arrow, text);
      ul.appendChild(li);
    });
    takeawaysSection.appendChild(ul);
  } else {
    const p = document.createElement('p');
    p.className = 'text-sm text-text-muted';
    p.textContent = 'No takeaways available.';
    takeawaysSection.appendChild(p);
  }
  wrapper.appendChild(takeawaysSection);

  if (followUpQuestions.length > 0) {
    const section = document.createElement('section');
    section.className = 'mb-10';
    section.appendChild(sectionHeading('Q&A'));
    const qaList = document.createElement('div');
    qaList.className = 'flex flex-col gap-3';
    followUpQuestions.forEach((qa) => {
      const card = document.createElement('div');
      card.className = 'bg-surface border border-border rounded-lg px-4 py-3.5';
      const q = document.createElement('p');
      q.className = 'text-sm font-semibold text-text leading-snug mb-1.5';
      q.textContent = qa.question ?? '';
      card.appendChild(q);
      if (qa.answer) {
        const a = document.createElement('p');
        a.className = 'text-[0.8125rem] text-text-muted leading-relaxed';
        a.textContent = qa.answer;
        card.appendChild(a);
      }
      qaList.appendChild(card);
    });
    section.appendChild(qaList);
    wrapper.appendChild(section);
  }

  const studiesSection = document.createElement('section');
  studiesSection.className = 'mb-10';
  studiesSection.appendChild(sectionHeading(`Studies (${studies.length})`));
  const studiesList = document.createElement('div');
  studiesList.className = 'flex flex-col gap-2';
  if (studies.length === 0) {
    const p = document.createElement('p');
    p.className = 'text-sm text-text-muted';
    p.textContent = 'No studies retrieved.';
    studiesList.appendChild(p);
  } else {
    studies.forEach((s) => studiesList.appendChild(studyCard(s)));
  }
  studiesSection.appendChild(studiesList);
  wrapper.appendChild(studiesSection);

  const cta = document.createElement('div');
  cta.className = 'border border-border rounded-lg px-6 py-5 text-center bg-surface mb-8';
  const ctaText = document.createElement('p');
  ctaText.className = 'text-[0.9375rem] text-text mb-3';
  ctaText.textContent = 'Want to run your own health and wellness research?';
  const ctaLink = document.createElement('a');
  ctaLink.href = '/register';
  ctaLink.className = 'inline-flex items-center bg-primary hover:bg-primary-hover text-white rounded-md px-5 py-2 text-sm font-semibold no-underline transition-colors';
  ctaLink.textContent = 'Try ResearchIQ free →';
  cta.append(ctaText, ctaLink);
  wrapper.appendChild(cta);

  app.className = '';
  app.replaceChildren(wrapper);
}

init();
