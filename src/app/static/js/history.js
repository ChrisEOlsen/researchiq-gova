import { get, post } from '/static/js/lib/api.js';
import { initNav } from '/static/js/lib/nav.js';

const app = document.getElementById('app');

const STAGE_LABELS = {
  searching: 'Searching PubMed…',
  filtering: 'Reviewing studies for relevance…',
  synthesizing: 'Writing summary…',
  visualizing: 'Generating visual explainer…',
};

const pollers = new Map();
let openMenu = null;

function truncateQuestion(question, max) {
  return question.length > max ? question.slice(0, max) : question;
}

async function init() {
  initNav();

  const me = await get('/api/auth/me');
  const isAuthed = !!me.ok;

  const res = await get('/api/research_history');
  if (!res.ok) {
    renderError(res.error ?? 'Failed to load history.');
    return;
  }
  renderJobs(res.data?.jobs ?? [], isAuthed);
}

function renderError(msg) {
  const p = document.createElement('p');
  p.className = 'text-sm text-red-600';
  p.textContent = msg;
  app.replaceChildren(p);
}

function renderJobs(jobs, isAuthed) {
  app.replaceChildren();
  if (jobs.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'text-center py-16 text-text-muted';
    const p = document.createElement('p');
    p.className = 'text-[1.0625rem] mb-4';
    p.textContent = 'No research yet.';
    const link = document.createElement('a');
    link.href = '/';
    link.className = 'text-primary text-sm no-underline';
    link.textContent = 'Ask your first question →';
    empty.append(p, link);
    app.appendChild(empty);
    return;
  }
  const list = document.createElement('div');
  list.className = 'flex flex-col gap-2.5';
  jobs.forEach((job) => list.appendChild(renderJobRow(job, isAuthed)));
  app.appendChild(list);
}

function renderJobRow(job, isAuthed) {
  const row = document.createElement('div');
  row.id = `job-row-${job.id}`;
  row.className = 'bg-surface border border-border rounded-lg px-[1.125rem] py-4';

  const top = document.createElement('div');
  top.className = 'flex items-start justify-between gap-2';

  const left = document.createElement('div');
  left.className = 'flex-1 min-w-0';
  const label = job.title || truncateQuestion(job.question, 80);
  if (job.status === 'done') {
    const link = document.createElement('a');
    link.href = `/result?id=${job.id}`;
    link.className = 'text-sm font-medium text-text hover:text-primary transition-colors no-underline line-clamp-2 leading-snug';
    link.textContent = label;
    left.appendChild(link);
  } else {
    const p = document.createElement('p');
    p.className = 'text-sm font-medium text-text m-0 leading-snug';
    p.textContent = label;
    left.appendChild(p);
  }
  top.appendChild(left);

  if (isAuthed) {
    top.appendChild(renderOptionsMenu(job, row));
  }
  row.appendChild(top);

  const meta = document.createElement('div');
  meta.className = 'flex items-center gap-3 mt-1.5';
  const date = document.createElement('span');
  date.className = 'text-xs text-text-muted';
  date.textContent = new Date(job.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  meta.appendChild(date);

  const statusEl = document.createElement('span');
  setStatusBadge(statusEl, job);
  meta.appendChild(statusEl);
  row.appendChild(meta);

  if (job.status !== 'done' && job.status !== 'failed') {
    startPolling(job.id, statusEl);
  }

  return row;
}

function renderOptionsMenu(job, row) {
  const wrap = document.createElement('div');
  wrap.className = 'relative shrink-0';

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.title = 'Options';
  toggle.className = 'flex items-center justify-center w-7 h-7 bg-transparent border-0 rounded-md cursor-pointer text-text-muted hover:bg-hover hover:text-text transition-colors';
  const dots = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  dots.setAttribute('width', '15');
  dots.setAttribute('height', '15');
  dots.setAttribute('viewBox', '0 0 24 24');
  dots.setAttribute('fill', 'currentColor');
  [5, 12, 19].forEach((cx) => {
    const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    c.setAttribute('cx', String(cx));
    c.setAttribute('cy', '12');
    c.setAttribute('r', '2');
    dots.appendChild(c);
  });
  toggle.appendChild(dots);

  const menu = document.createElement('div');
  menu.className = 'hidden absolute right-0 top-[calc(100%+4px)] bg-surface border border-border rounded-lg shadow-lg min-w-[130px] z-50 p-1';

  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.className = 'flex items-center gap-2 w-full bg-transparent border-0 rounded-md px-3 py-2 text-[0.8125rem] text-red-600 cursor-pointer text-left hover:bg-red-50 transition-colors';
  deleteBtn.textContent = 'Delete';
  deleteBtn.addEventListener('click', async () => {
    if (!confirm('Delete this research? This cannot be undone.')) return;
    deleteBtn.disabled = true;
    const res = await post('/api/research_delete', { job_id: job.id });
    if (res.ok) {
      stopPolling(job.id);
      row.remove();
    } else {
      deleteBtn.disabled = false;
    }
  });
  menu.appendChild(deleteBtn);

  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    const willOpen = menu.classList.contains('hidden');
    if (openMenu && openMenu !== menu) openMenu.classList.add('hidden');
    menu.classList.toggle('hidden', !willOpen);
    openMenu = willOpen ? menu : null;
  });

  wrap.append(toggle, menu);
  return wrap;
}

document.addEventListener('click', () => {
  if (openMenu) {
    openMenu.classList.add('hidden');
    openMenu = null;
  }
});

function setStatusBadge(el, job) {
  el.replaceChildren();
  el.className = 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-medium';

  if (job.status === 'failed') {
    el.classList.add('bg-red-100', 'text-red-800');
    el.textContent = 'Failed';
    if (job.error_message) el.title = job.error_message;
    return;
  }

  if (job.status === 'done') {
    el.classList.add('bg-green-100', 'text-green-800');
    el.textContent = 'Done';
    return;
  }

  el.classList.add('bg-yellow-100', 'text-yellow-800');
  const dot = document.createElement('span');
  dot.className = 'inline-block w-2 h-2 rounded-full bg-primary animate-pulse-dot';
  el.appendChild(dot);

  let text = STAGE_LABELS[job.pipeline_stage] || 'Processing…';
  if (job.pipeline_stage === 'searching' && job.studies_found > 0) {
    text += ` Found ${job.studies_found} studies so far…`;
  }
  el.appendChild(document.createTextNode(text));
}

function startPolling(jobId, statusEl) {
  if (pollers.has(jobId)) return;
  const intervalId = setInterval(async () => {
    const res = await get(`/api/research_status?job_id=${jobId}`);
    if (!res.ok) return;
    const job = res.data;
    setStatusBadge(statusEl, job);
    if (job.status === 'done') {
      stopPolling(jobId);
      window.location.href = `/result?id=${jobId}`;
    } else if (job.status === 'failed') {
      stopPolling(jobId);
    }
  }, 3000);
  pollers.set(jobId, intervalId);
}

function stopPolling(jobId) {
  const id = pollers.get(jobId);
  if (id) {
    clearInterval(id);
    pollers.delete(jobId);
  }
}

// @inject-forms

init();
