import { get, post } from './api.js';

const NAV_ITEM_CLASS = 'block md:inline text-text-muted hover:text-primary transition-colors text-left';

function buildItems(isAuthed) {
  const items = [
    { label: 'Home', href: '/' },
    { label: 'My Research', href: '/history' },
  ];
  if (isAuthed) {
    items.push({ label: 'Settings', href: '/settings' });
    items.push({ label: 'Sign Out', action: 'signout' });
  } else {
    items.push({ label: 'Sign In', href: '/login' });
    items.push({ label: 'Register', href: '/register' });
  }
  return items;
}

async function handleSignOut() {
  await post('/api/auth/logout');
  window.location.href = '/';
}

function renderInto(container, items) {
  container.replaceChildren();
  items.forEach((item) => {
    if (item.action === 'signout') {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = NAV_ITEM_CLASS;
      btn.textContent = item.label;
      btn.addEventListener('click', handleSignOut);
      container.appendChild(btn);
      return;
    }
    const a = document.createElement('a');
    a.href = item.href;
    a.className = NAV_ITEM_CLASS;
    a.textContent = item.label;
    container.appendChild(a);
  });
}

// initNav wires up the shared site nav: auth-aware link set (Home/My Research
// always, Settings+Sign Out when authed, Sign In+Register when guest) and the
// mobile hamburger toggle. Expects #nav-links (desktop), #nav-mobile-menu
// (mobile panel) and #nav-toggle (hamburger button) in the page markup.
export async function initNav() {
  const desktopLinks = document.getElementById('nav-links');
  const mobileMenu = document.getElementById('nav-mobile-menu');
  const toggle = document.getElementById('nav-toggle');

  if (toggle && mobileMenu) {
    toggle.addEventListener('click', () => {
      const willOpen = mobileMenu.classList.contains('hidden');
      mobileMenu.classList.toggle('hidden');
      toggle.setAttribute('aria-expanded', String(willOpen));
    });
  }

  let isAuthed = false;
  try {
    const res = await get('/api/auth/me');
    isAuthed = !!res.ok;
  } catch {
    isAuthed = false;
  }

  const items = buildItems(isAuthed);
  if (desktopLinks) renderInto(desktopLinks, items);
  if (mobileMenu) renderInto(mobileMenu, items);
}
