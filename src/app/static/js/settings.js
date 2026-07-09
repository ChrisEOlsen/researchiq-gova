import { get, post } from '/static/js/lib/api.js';
import { requireAuth } from '/static/js/lib/auth.js';

const app = document.getElementById('app');

async function init() {
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
  h2.className = 'text-sm font-semibold text-gray-900 mb-2';
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
  card.className = 'bg-white border border-gray-200 rounded-lg p-6 space-y-3';

  const emailRow = document.createElement('p');
  emailRow.className = 'text-sm text-gray-700';
  const emailLabel = document.createElement('span');
  emailLabel.className = 'text-gray-500';
  emailLabel.textContent = 'Email: ';
  emailRow.appendChild(emailLabel);
  emailRow.appendChild(document.createTextNode(user.email ?? ''));
  card.appendChild(emailRow);

  const memberSinceRow = document.createElement('p');
  memberSinceRow.className = 'text-sm text-gray-700';
  const memberLabel = document.createElement('span');
  memberLabel.className = 'text-gray-500';
  memberLabel.textContent = 'Member since: ';
  memberSinceRow.appendChild(memberLabel);
  memberSinceRow.appendChild(document.createTextNode(formatDate(user.created_at)));
  card.appendChild(memberSinceRow);

  const balanceRow = document.createElement('p');
  balanceRow.className = 'text-sm text-gray-700 flex items-center gap-2';
  const balanceLabel = document.createElement('span');
  balanceLabel.className = 'text-gray-500';
  balanceLabel.textContent = 'Credit balance: ';
  balanceRow.appendChild(balanceLabel);

  if (user.lifetime_access) {
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = '∞';
    balanceRow.appendChild(badge);
  } else {
    const balance = document.createElement('span');
    balance.className = 'font-medium text-gray-900';
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
    p.className = 'text-sm text-gray-500';
    p.textContent = 'No credit packs available.';
    section.appendChild(p);
    return section;
  }

  const grid = document.createElement('div');
  grid.className = 'flex flex-wrap gap-4';
  packs.forEach((pack) => grid.appendChild(renderPackCard(pack)));
  section.appendChild(grid);
  return section;
}

function renderPackCard(pack) {
  const card = document.createElement('div');
  card.className = 'bg-white border border-gray-200 rounded-lg p-4 flex flex-col gap-3 w-full max-w-sm';

  const name = document.createElement('p');
  name.className = 'text-sm font-semibold text-gray-900';
  name.textContent = capitalize(pack.id ?? '');
  card.appendChild(name);

  const credits = document.createElement('p');
  credits.className = 'text-2xl font-semibold tracking-tight';
  credits.textContent = `${pack.credits ?? 0} credits`;
  card.appendChild(credits);

  const price = document.createElement('p');
  price.className = 'text-sm text-gray-500';
  price.textContent = pack.price ?? '';
  card.appendChild(price);

  const buyBtn = document.createElement('button');
  buyBtn.type = 'button';
  buyBtn.className = 'px-4 py-2 bg-gray-900 text-white text-sm rounded hover:bg-gray-700 transition-colors';
  buyBtn.textContent = 'Buy';

  if (!pack.price_id) {
    buyBtn.disabled = true;
    buyBtn.title = 'This pack is not currently available.';
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

  card.appendChild(buyBtn);
  return card;
}

function renderHistorySection(transactions) {
  const section = makeSection('Transaction history');

  if (transactions.length === 0) {
    const p = document.createElement('p');
    p.className = 'text-sm text-gray-500';
    p.textContent = 'No transactions yet.';
    section.appendChild(p);
    return section;
  }

  const tableWrap = document.createElement('div');
  tableWrap.className = 'bg-white border border-gray-200 rounded-lg';

  const table = document.createElement('table');
  table.className = 'w-full text-sm';

  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  headRow.className = 'border-b border-gray-200 text-gray-500';
  ['Date', 'Type', 'Amount', 'Description'].forEach((label) => {
    const th = document.createElement('th');
    th.className = 'px-4 py-2 font-medium';
    th.style.textAlign = 'left';
    th.textContent = label;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  transactions.forEach((tx) => {
    const row = document.createElement('tr');
    row.className = 'border-b border-gray-100';

    const dateCell = document.createElement('td');
    dateCell.className = 'px-4 py-2 text-gray-500';
    dateCell.textContent = formatDate(tx.created_at);
    row.appendChild(dateCell);

    const typeCell = document.createElement('td');
    typeCell.className = 'px-4 py-2 text-gray-700';
    typeCell.textContent = capitalize(tx.type ?? '');
    row.appendChild(typeCell);

    const amountCell = document.createElement('td');
    amountCell.className = 'px-4 py-2 text-gray-900 font-medium';
    const amount = Number(tx.amount ?? 0);
    amountCell.textContent = amount > 0 ? `+${amount}` : String(amount);
    row.appendChild(amountCell);

    const descCell = document.createElement('td');
    descCell.className = 'px-4 py-2 text-gray-500';
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
