import { get, post } from '/static/js/lib/api.js';
import { requireAuth } from '/static/js/lib/auth.js';
import { initNav } from '/static/js/lib/nav.js';

const app = document.getElementById('app');

async function init() {
  initNav();

  const user = await requireAuth();
  if (!user) return;

  const res = await get('/api/settings');
  if (!res.ok) {
    renderError(res.error ?? 'Failed to load settings.');
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
  h2.className = 'font-display text-lg font-semibold text-text mb-3';
  h2.textContent = heading;
  section.appendChild(h2);
  return section;
}

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

function render(data) {
  const user = data.user ?? {};
  const packs = Array.isArray(data.credit_packs) ? data.credit_packs : [];
  const transactions = Array.isArray(data.transactions) ? data.transactions : [];

  const wrapper = document.createElement('div');
  wrapper.className = 'space-y-8';

  wrapper.appendChild(renderAccountSection(user));
  wrapper.appendChild(renderPacksSection(packs));
  wrapper.appendChild(renderHistorySection(transactions));

  app.replaceChildren(wrapper);
}

function renderAccountSection(user) {
  const section = makeSection('Account');
  const card = document.createElement('div');
  card.className = 'bg-surface border border-border rounded-lg p-6 space-y-3';

  const emailRow = document.createElement('p');
  emailRow.className = 'text-sm text-text';
  const emailLabel = document.createElement('span');
  emailLabel.className = 'text-text-muted';
  emailLabel.textContent = 'Email: ';
  emailRow.appendChild(emailLabel);
  emailRow.appendChild(document.createTextNode(user.email ?? ''));
  card.appendChild(emailRow);

  const memberSinceRow = document.createElement('p');
  memberSinceRow.className = 'text-sm text-text';
  const memberLabel = document.createElement('span');
  memberLabel.className = 'text-text-muted';
  memberLabel.textContent = 'Member since: ';
  memberSinceRow.appendChild(memberLabel);
  memberSinceRow.appendChild(document.createTextNode(formatDate(user.created_at)));
  card.appendChild(memberSinceRow);

  const balanceRow = document.createElement('p');
  balanceRow.className = 'text-sm text-text flex items-center gap-2';
  const balanceLabel = document.createElement('span');
  balanceLabel.className = 'text-text-muted';
  balanceLabel.textContent = 'Credit balance: ';
  balanceRow.appendChild(balanceLabel);

  if (user.lifetime_access) {
    const badge = document.createElement('span');
    badge.className = 'inline-block text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-800';
    badge.textContent = '∞';
    balanceRow.appendChild(badge);
  } else {
    const balance = document.createElement('span');
    balance.className = 'font-medium text-text';
    balance.textContent = String(user.credits ?? 0);
    balanceRow.appendChild(balance);
  }
  card.appendChild(balanceRow);

  section.appendChild(card);
  return section;
}

function renderPacksSection(packs) {
  const section = makeSection('Buy credits');

  if (packs.length === 0) {
    const p = document.createElement('p');
    p.className = 'text-sm text-text-muted';
    p.textContent = 'No credit packs available.';
    section.appendChild(p);
    return section;
  }

  const list = document.createElement('div');
  list.className = 'flex flex-col gap-3';
  packs.forEach((pack) => list.appendChild(renderPackCard(pack)));
  section.appendChild(list);
  return section;
}

function renderPackCard(pack) {
  const card = document.createElement('div');
  card.className = 'bg-surface border border-border rounded-lg p-4 sm:p-6 flex items-center justify-between gap-4';

  const info = document.createElement('div');
  info.className = 'min-w-0';

  const name = document.createElement('p');
  name.className = 'text-sm font-semibold text-text';
  name.textContent = capitalize(pack.id ?? '');
  info.appendChild(name);

  const credits = document.createElement('p');
  credits.className = 'text-xl font-display font-semibold text-text mt-1';
  credits.textContent = `${pack.credits ?? 0} credits`;
  info.appendChild(credits);

  const price = document.createElement('p');
  price.className = 'text-sm text-text-muted mt-1';
  price.textContent = pack.price ?? '';
  info.appendChild(price);

  const buyBtn = document.createElement('button');
  buyBtn.type = 'button';
  buyBtn.className = 'px-4 py-2 bg-primary text-white text-sm font-medium rounded hover:bg-primary-hover transition-colors shrink-0';
  buyBtn.textContent = 'Buy';

  if (!pack.price_id) {
    buyBtn.disabled = true;
    buyBtn.title = 'This pack is not currently available.';
    buyBtn.className = 'px-4 py-2 bg-surface-2 text-text-muted text-sm font-medium rounded shrink-0 cursor-not-allowed';
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
    errEl.className = 'text-sm text-red-600';
    errEl.textContent = res.error ?? 'Something went wrong.';
    card.appendChild(errEl);
  });

  card.append(info, buyBtn);
  return card;
}

function renderHistorySection(transactions) {
  const section = makeSection('Transaction history');

  if (transactions.length === 0) {
    const p = document.createElement('p');
    p.className = 'text-sm text-text-muted';
    p.textContent = 'No transactions yet.';
    section.appendChild(p);
    return section;
  }

  const tableWrap = document.createElement('div');
  tableWrap.className = 'bg-surface border border-border rounded-lg overflow-x-auto';

  const table = document.createElement('table');
  table.className = 'w-full text-sm';

  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  headRow.className = 'border-b border-border text-text-muted';
  ['Date', 'Type', 'Amount', 'Description'].forEach((label) => {
    const th = document.createElement('th');
    th.className = 'px-4 py-2 font-medium text-left';
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
    dateCell.className = 'px-4 py-2 text-text-muted';
    dateCell.textContent = formatDate(tx.created_at);
    row.appendChild(dateCell);

    const typeCell = document.createElement('td');
    typeCell.className = 'px-4 py-2 text-text';
    typeCell.textContent = capitalize(tx.type ?? '');
    row.appendChild(typeCell);

    const amountCell = document.createElement('td');
    amountCell.className = 'px-4 py-2 text-text font-medium';
    const amount = Number(tx.amount ?? 0);
    amountCell.textContent = amount > 0 ? `+${amount}` : String(amount);
    row.appendChild(amountCell);

    const descCell = document.createElement('td');
    descCell.className = 'px-4 py-2 text-text-muted';
    descCell.textContent = tx.description ?? '';
    row.appendChild(descCell);

    tbody.appendChild(row);
  });
  table.appendChild(tbody);

  tableWrap.appendChild(table);
  section.appendChild(tableWrap);
  return section;
}

// @inject-forms

init();
