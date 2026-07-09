import { get, post } from './api.js';

const LINK_CLASS = 'block md:inline text-sm text-text-muted hover:text-primary transition-colors text-left no-underline';
const REGISTER_CLASS = 'block md:inline-block text-sm text-white bg-primary hover:bg-primary-hover transition-colors px-3.5 py-1.5 rounded-md no-underline text-center';

async function guestFreeCreditsLeft() {
  const hist = await get('/api/research_history');
  if (!hist.ok) return 5;
  const doneCount = (hist.data?.jobs ?? []).filter((j) => j.status === 'done').length;
  return Math.max(0, 5 - doneCount);
}

async function handleSignOut() {
  await post('/api/auth/logout');
  window.location.href = '/';
}

function link(label, href, extraClass) {
  const a = document.createElement('a');
  a.href = href;
  a.className = extraClass || LINK_CLASS;
  a.textContent = label;
  return a;
}

function creditsLabel(credits, lifetimeAccess, suffix) {
  const span = document.createElement('span');
  span.className = 'block md:inline text-sm text-text-muted';
  span.textContent = lifetimeAccess ? '∞ credits' : `${credits} ${suffix}`;
  return span;
}

function settingsGearLink() {
  const a = document.createElement('a');
  a.href = '/settings';
  a.title = 'Settings';
  a.className = 'text-text-muted hover:text-primary transition-colors inline-flex items-center';
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '16');
  svg.setAttribute('height', '16');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  circle.setAttribute('cx', '12');
  circle.setAttribute('cy', '12');
  circle.setAttribute('r', '3');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z');
  svg.append(circle, path);
  a.appendChild(svg);
  return a;
}

function signOutButton(extraClass) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = extraClass || LINK_CLASS;
  btn.textContent = 'Logout';
  btn.addEventListener('click', handleSignOut);
  return btn;
}

function buildItems(isAuthed, credits, lifetimeAccess, guestFreeLeft) {
  const items = [link('New Research', '/'), link('My Research', '/history')];
  if (isAuthed) {
    items.push(creditsLabel(credits, lifetimeAccess, 'credits'));
    items.push(settingsGearLink());
    items.push(signOutButton());
  } else {
    const span = document.createElement('span');
    span.className = 'block md:inline text-sm text-text-muted';
    span.textContent = `${guestFreeLeft} free credits left`;
    items.push(span);
    items.push(link('Sign in', '/login'));
    items.push(link('Register', '/register', REGISTER_CLASS));
  }
  return items;
}

function renderInto(container, items) {
  container.replaceChildren(...items);
}

// initNav wires up the shared site nav, matching the production app's
// layout: New Research/My Research always, then credits + settings gear +
// Logout when authed, or free-credits-left + Sign in + Register when guest.
// Expects #nav-links (desktop), #nav-mobile-menu (mobile panel) and
// #nav-toggle (hamburger button) in the page markup.
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
  let credits = 0;
  let lifetimeAccess = false;
  let guestFreeLeft = 5;
  try {
    const res = await get('/api/auth/me');
    isAuthed = !!res.ok;
    if (isAuthed) {
      credits = res.data.credits ?? 0;
      lifetimeAccess = !!res.data.lifetime_access;
    } else {
      guestFreeLeft = await guestFreeCreditsLeft();
    }
  } catch {
    isAuthed = false;
  }

  if (desktopLinks) renderInto(desktopLinks, buildItems(isAuthed, credits, lifetimeAccess, guestFreeLeft));
  if (mobileMenu) renderInto(mobileMenu, buildItems(isAuthed, credits, lifetimeAccess, guestFreeLeft));
}
