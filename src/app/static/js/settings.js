import { get, post } from '/static/js/lib/api.js';
import { requireAuth } from '/static/js/lib/auth.js';
import { initNav } from '/static/js/lib/nav.js';

const app = document.getElementById('app');

function capitalize(s) {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

async function init() {
  initNav();

  const user = await requireAuth();
  if (!user) return;

  const paymentSuccess = new URLSearchParams(window.location.search).get('payment') === 'success';

  const res = await get('/api/settings');
  if (!res.ok) {
    renderError(res.error ?? 'Failed to load settings.');
    return;
  }
  render(res.data, paymentSuccess);
}

function renderError(msg) {
  app.className = '';
  const p = document.createElement('p');
  p.className = 'text-sm text-red-600';
  p.textContent = msg;
  app.replaceChildren(p);
}

function sectionCard() {
  const section = document.createElement('section');
  section.className = 'bg-surface border border-border rounded-lg p-6 mb-6';
  return section;
}

function sectionHeading(text) {
  const h2 = document.createElement('h2');
  h2.className = 'text-[0.9375rem] font-semibold text-text mb-4';
  h2.textContent = text;
  return h2;
}

function render(data, paymentSuccess) {
  const user = data.user ?? {};
  const packs = Array.isArray(data.credit_packs) ? data.credit_packs : [];
  const transactions = Array.isArray(data.transactions) ? data.transactions : [];

  const wrapper = document.createElement('div');
  wrapper.className = 'animate-fade-in';

  if (paymentSuccess) {
    const banner = document.createElement('div');
    banner.className = 'bg-green-50 border border-green-600 rounded-md px-4 py-3 mb-6';
    const p = document.createElement('p');
    p.className = 'text-sm text-green-700 m-0';
    p.textContent = 'Payment successful — credits added to your account.';
    banner.appendChild(p);
    wrapper.appendChild(banner);
  }

  wrapper.appendChild(renderAccountSection(user));
  wrapper.appendChild(renderCreditsSection(user, packs));
  if (transactions.length > 0) wrapper.appendChild(renderHistorySection(transactions));

  app.className = '';
  app.replaceChildren(wrapper);
}

function infoRow(label, valueText) {
  const row = document.createElement('div');
  row.className = 'flex justify-between items-center';
  const l = document.createElement('span');
  l.className = 'text-sm text-text-muted';
  l.textContent = label;
  const v = document.createElement('span');
  v.className = 'text-sm text-text';
  v.textContent = valueText;
  row.append(l, v);
  return row;
}

function renderAccountSection(user) {
  const section = sectionCard();
  section.appendChild(sectionHeading('Account'));
  const rows = document.createElement('div');
  rows.className = 'flex flex-col gap-2.5';
  rows.appendChild(infoRow('Email', user.email ?? ''));
  rows.appendChild(infoRow('Member since', formatDate(user.created_at)));
  section.appendChild(rows);
  return section;
}

function renderCreditsSection(user, packs) {
  const section = sectionCard();
  section.appendChild(sectionHeading('Credits'));

  if (user.lifetime_access) {
    const row = document.createElement('div');
    row.className = 'flex items-center gap-3';
    const infinity = document.createElement('span');
    infinity.className = 'font-display text-[2.5rem] font-bold text-text';
    infinity.textContent = '∞';
    const badge = document.createElement('span');
    badge.className = 'text-sm bg-green-50 text-green-700 border border-green-200 rounded-md px-2.5 py-1 font-medium';
    badge.textContent = 'Lifetime Access';
    row.append(infinity, badge);
    section.appendChild(row);
    return section;
  }

  const balanceRow = document.createElement('div');
  balanceRow.className = 'flex items-baseline gap-2 mb-6';
  const num = document.createElement('span');
  num.className = 'font-display text-[2.5rem] font-bold text-text';
  num.textContent = String(user.credits ?? 0);
  const label = document.createElement('span');
  label.className = 'text-[0.9375rem] text-text-muted';
  label.textContent = 'credits remaining';
  balanceRow.append(num, label);
  section.appendChild(balanceRow);

  const hint = document.createElement('p');
  hint.className = 'text-[0.8125rem] text-text-muted mb-5';
  hint.textContent = 'Each research query uses 1 credit.';
  section.appendChild(hint);

  const list = document.createElement('div');
  list.className = 'flex flex-col gap-3';
  packs.forEach((pack) => list.appendChild(renderPackRow(pack)));
  section.appendChild(list);
  return section;
}

function renderPackRow(pack) {
  const row = document.createElement('div');
  row.className = 'flex items-center justify-between bg-bg border border-border rounded-md px-4 py-3.5';

  const info = document.createElement('div');
  const name = document.createElement('p');
  name.className = 'text-sm font-medium text-text m-0';
  name.textContent = `${capitalize(pack.id ?? '')} Pack`;
  const credits = document.createElement('p');
  credits.className = 'text-xs text-text-muted mt-0.5';
  credits.textContent = `${pack.credits ?? 0} credits`;
  info.append(name, credits);

  const buyBtn = document.createElement('button');
  buyBtn.type = 'button';
  buyBtn.className = 'bg-primary hover:bg-primary-hover text-white rounded-md px-4 py-2 text-sm font-medium transition-colors';
  buyBtn.textContent = pack.price ?? 'Buy';

  if (!pack.price_id) {
    buyBtn.disabled = true;
    buyBtn.title = 'This pack is not currently available.';
    buyBtn.className = 'bg-surface-2 text-text-muted rounded-md px-4 py-2 text-sm font-medium cursor-not-allowed';
  }

  buyBtn.addEventListener('click', async () => {
    buyBtn.disabled = true;
    const res = await post('/api/payments_checkout', { price_id: pack.price_id });
    if (res.ok && res.data?.checkout_url) {
      window.location.href = res.data.checkout_url;
      return;
    }
    buyBtn.disabled = false;
    const errEl = document.createElement('p');
    errEl.className = 'text-sm text-red-600 mt-2';
    errEl.textContent = res.error ?? 'Something went wrong.';
    row.appendChild(errEl);
  });

  row.append(info, buyBtn);
  return row;
}

function renderHistorySection(transactions) {
  const section = sectionCard();
  section.appendChild(sectionHeading('Transaction History'));

  const table = document.createElement('table');
  table.className = 'w-full border-collapse';

  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  headRow.className = 'border-b border-border';
  [['Date', 'text-left'], ['Description', 'text-left'], ['Credits', 'text-right']].forEach(([label, align]) => {
    const th = document.createElement('th');
    th.className = `text-xs font-medium text-text-muted pb-2 ${align}`;
    th.textContent = label;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  transactions.forEach((tx) => {
    const row = document.createElement('tr');
    row.className = 'border-b border-border last:border-b-0';

    const dateCell = document.createElement('td');
    dateCell.className = 'text-xs text-text-muted py-2.5 whitespace-nowrap';
    dateCell.textContent = new Date(tx.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    row.appendChild(dateCell);

    const descCell = document.createElement('td');
    descCell.className = 'text-[0.8125rem] text-text py-2.5 px-2';
    const descText = tx.description || (tx.type === 'usage' ? 'Research' : tx.type);
    if (tx.type === 'usage' && tx.job_id) {
      const link = document.createElement('a');
      link.href = `/result?id=${tx.job_id}`;
      link.className = 'text-text no-underline hover:text-primary transition-colors';
      link.textContent = descText;
      descCell.appendChild(link);
    } else {
      descCell.textContent = descText;
    }
    row.appendChild(descCell);

    const amountCell = document.createElement('td');
    const amount = Number(tx.amount ?? 0);
    amountCell.className = `text-right text-[0.8125rem] font-medium py-2.5 ${amount > 0 ? 'text-green-600' : 'text-text-muted'}`;
    amountCell.textContent = amount > 0 ? `+${amount}` : String(amount);
    row.appendChild(amountCell);

    tbody.appendChild(row);
  });
  table.appendChild(tbody);

  section.appendChild(table);
  return section;
}

// @inject-forms

init();
