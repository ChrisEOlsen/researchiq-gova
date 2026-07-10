import { get, post } from '/static/js/lib/api.js';
import { initNav } from '/static/js/lib/nav.js';

const app = document.getElementById('app');
const params = new URLSearchParams(window.location.search);
const jobId = params.get('id');

async function init() {
  initNav();

  if (!jobId) {
    renderError('Missing result id.');
    return;
  }
  const res = await get(`/api/research_result?id=${encodeURIComponent(jobId)}`);
  if (!res.ok) {
    renderError(res.error ?? 'Result not found.');
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
    a.className = 'text-sm font-medium text-primary no-underline hover:underline block leading-snug';
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

function renderShareArea(container, job) {
  container.id = 'share-area';
  container.className = 'mb-6';
  renderShareState(container, job.share_token || '');
}

function renderShareState(container, shareToken) {
  container.replaceChildren();
  if (shareToken) {
    const shareUrl = `${window.location.origin}/share?t=${shareToken}`;
    const hint = document.createElement('p');
    hint.className = 'text-[0.8125rem] text-text-muted mb-2';
    hint.textContent = 'Anyone with this link can view this result — no account required.';
    container.appendChild(hint);

    const row = document.createElement('div');
    row.className = 'flex items-center gap-2';

    const input = document.createElement('input');
    input.type = 'text';
    input.readOnly = true;
    input.value = shareUrl;
    input.className = 'flex-1 min-w-0 text-[0.8125rem] bg-surface-2 border border-border rounded-md px-3 py-1.5 text-text outline-none';
    input.addEventListener('click', () => input.select());

    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'shrink-0 bg-primary hover:bg-primary-hover text-white rounded-md px-3.5 py-1.5 text-[0.8125rem] font-semibold whitespace-nowrap transition-colors';
    copyBtn.textContent = 'Copy link';
    copyBtn.addEventListener('click', async () => {
      await navigator.clipboard.writeText(shareUrl);
      copyBtn.textContent = 'Copied!';
      setTimeout(() => { copyBtn.textContent = 'Copy link'; }, 2000);
    });

    row.append(input, copyBtn);
    container.appendChild(row);
    return;
  }

  const shareBtn = document.createElement('button');
  shareBtn.type = 'button';
  shareBtn.className = 'bg-surface text-text border border-border rounded-md px-3.5 py-1.5 text-[0.8125rem] font-medium hover:bg-hover transition-colors';
  shareBtn.textContent = 'Share result';
  shareBtn.addEventListener('click', async () => {
    shareBtn.disabled = true;
    const res = await post('/api/research_share', { job_id: Number(jobId) });
    shareBtn.disabled = false;
    if (!res.ok) return;
    // Rebuild from the browser's actual origin rather than trusting the
    // server's APP_URL — keeps this in sync with wherever the app is
    // really being accessed from, same as the already-shared render path.
    const token = res.data.share_url.split('?t=')[1];
    renderShareState(container, token);
    const shareUrl = `${window.location.origin}/share?t=${token}`;
    await navigator.clipboard.writeText(shareUrl).catch(() => {});
    const copyBtn = container.querySelector('button');
    if (copyBtn) {
      copyBtn.textContent = 'Copied!';
      setTimeout(() => { copyBtn.textContent = 'Copy link'; }, 2000);
    }
  });
  container.appendChild(shareBtn);
}

function renderVisualCallout(jobId) {
  const callout = document.createElement('div');
  callout.className = 'flex items-center justify-between gap-4 bg-surface-2 border-l-[3px] border-primary rounded-r-md px-4 py-3 mb-10';
  const text = document.createElement('p');
  text.className = 'text-[0.8125rem] italic text-text-muted m-0 leading-snug';
  text.textContent = '✦ Visual explainer available — see the findings illustrated';
  const link = document.createElement('a');
  link.href = `/api/research_visual?job_id=${jobId}`;
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

  const shareArea = document.createElement('div');
  renderShareArea(shareArea, job);
  wrapper.appendChild(shareArea);

  wrapper.appendChild(renderVisualCallout(job.id));

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
      arrow.className = 'text-primary shrink-0 mt-0.5';
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

  app.className = '';
  app.replaceChildren(wrapper);
}

init();
