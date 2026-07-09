import { get, post } from '/static/js/lib/api.js';

const app = document.getElementById('app');

const STAGE_LABELS = {
  searching: 'Searching PubMed…',
  filtering: 'Reviewing studies for relevance…',
  synthesizing: 'Writing summary…',
  visualizing: 'Generating visual explainer…',
};

const pollers = new Map();

async function init() {
  const res = await get('/api/research_history');
  if (!res.ok) {
    renderError(res.error ?? 'Failed to load history.');
    return;
  }
  renderJobs(res.data?.jobs ?? []);
}

function renderError(msg) {
  const p = document.createElement('p');
  p.className = 'text-sm text-red-600';
  p.textContent = msg;
  app.replaceChildren(p);
}

function renderJobs(jobs) {
  app.replaceChildren();
  if (jobs.length === 0) {
    const p = document.createElement('p');
    p.className = 'text-sm text-gray-500';
    p.textContent = 'No research yet. Ask a question from the home page to get started.';
    app.appendChild(p);
    return;
  }
  const list = document.createElement('div');
  list.className = 'space-y-3';
  jobs.forEach((job) => list.appendChild(renderJobCard(job)));
  app.appendChild(list);
}

function renderJobCard(job) {
  const card = document.createElement('div');
  card.className = 'bg-white border border-gray-200 rounded-lg p-4 flex items-center justify-between gap-4';

  const left = document.createElement('div');
  left.className = 'min-w-0';

  const title = document.createElement('p');
  title.className = 'text-sm font-medium text-gray-900';
  title.textContent = job.title || job.question;
  left.appendChild(title);

  const statusEl = document.createElement('p');
  statusEl.className = 'text-xs text-gray-500 mt-1';
  setStatusText(statusEl, job);
  left.appendChild(statusEl);

  const right = document.createElement('div');
  right.className = 'flex items-center gap-3 shrink-0';

  if (job.status === 'done') {
    const viewLink = document.createElement('a');
    viewLink.href = `/result?id=${job.id}`;
    viewLink.className = 'text-xs text-blue-600 hover:underline';
    viewLink.textContent = 'View';
    right.appendChild(viewLink);
  }

  const delBtn = document.createElement('button');
  delBtn.type = 'button';
  delBtn.className = 'text-xs text-red-600 hover:underline';
  delBtn.textContent = 'Delete';
  delBtn.addEventListener('click', async () => {
    delBtn.disabled = true;
    const res = await post('/api/research_delete', { job_id: job.id });
    if (res.ok) {
      stopPolling(job.id);
      card.remove();
    } else {
      delBtn.disabled = false;
    }
  });
  right.appendChild(delBtn);

  card.append(left, right);

  if (job.status !== 'done' && job.status !== 'failed') {
    startPolling(job.id, statusEl);
  }

  return card;
}

function setStatusText(el, job) {
  el.replaceChildren();

  if (job.status === 'failed') {
    const badge = document.createElement('span');
    badge.className = 'badge badge-failed';
    badge.textContent = 'Failed';
    if (job.error_message) {
      badge.title = job.error_message;
    }
    el.appendChild(badge);
    return;
  }

  if (job.status === 'done') {
    const badge = document.createElement('span');
    badge.className = 'badge badge-done';
    badge.textContent = 'Done';
    el.appendChild(badge);
    return;
  }

  const dot = document.createElement('span');
  dot.className = 'pulse-dot';
  el.appendChild(dot);

  let text = ' ' + (STAGE_LABELS[job.pipeline_stage] || 'Processing…');
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
    setStatusText(statusEl, job);
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
