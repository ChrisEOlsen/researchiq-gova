import { get, post } from './api.js';

const DESKTOP_LINK_CLASS = 'text-sm text-text-muted hover:text-primary transition-colors no-underline';
const DESKTOP_REGISTER_CLASS = 'text-sm text-white bg-primary hover:bg-primary-hover transition-colors px-3.5 py-1.5 rounded-md no-underline';

const MOBILE_LINK_CLASS = 'block text-[0.9375rem] text-text no-underline py-3 border-b border-border';
const MOBILE_REGISTER_CLASS = 'block text-center text-[0.9375rem] font-medium text-white bg-primary hover:bg-primary-hover transition-colors py-3 rounded-lg no-underline mt-3';

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

function link(label, href, className) {
  const a = document.createElement('a');
  a.href = href;
  a.className = className;
  a.textContent = label;
  return a;
}

function settingsGearIcon() {
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
  return svg;
}

function settingsGearLink() {
  const a = document.createElement('a');
  a.href = '/settings';
  a.title = 'Settings';
  a.className = 'text-text-muted hover:text-primary transition-colors inline-flex items-center';
  a.appendChild(settingsGearIcon());
  return a;
}

// ---- Desktop: compact single row ----

function buildDesktopItems(isAuthed, credits, lifetimeAccess, guestFreeLeft) {
  const items = [link('New Research', '/', DESKTOP_LINK_CLASS), link('My Research', '/history', DESKTOP_LINK_CLASS)];
  if (isAuthed) {
    const creditsEl = document.createElement('span');
    creditsEl.className = 'text-sm text-text-muted';
    creditsEl.textContent = lifetimeAccess ? '∞ credits' : `${credits} credits`;
    items.push(creditsEl, settingsGearLink());
    const signOut = document.createElement('button');
    signOut.type = 'button';
    signOut.className = DESKTOP_LINK_CLASS;
    signOut.textContent = 'Logout';
    signOut.addEventListener('click', handleSignOut);
    items.push(signOut);
  } else {
    const guestEl = document.createElement('span');
    guestEl.className = 'text-sm text-text-muted';
    guestEl.textContent = `${guestFreeLeft} free credits left`;
    items.push(guestEl, link('Sign in', '/login', DESKTOP_LINK_CLASS), link('Register', '/register', DESKTOP_REGISTER_CLASS));
  }
  return items;
}

// ---- Mobile: full-width divided list, credits+logout as a row, prominent register button ----

function buildMobileItems(isAuthed, credits, lifetimeAccess, guestFreeLeft) {
  const items = [link('New Research', '/', MOBILE_LINK_CLASS), link('My Research', '/history', MOBILE_LINK_CLASS)];

  if (isAuthed) {
    items.push(link('Settings', '/settings', MOBILE_LINK_CLASS));

    const row = document.createElement('div');
    row.className = 'flex items-center justify-between py-3';
    const creditsEl = document.createElement('span');
    creditsEl.className = 'text-sm text-text-muted';
    creditsEl.textContent = lifetimeAccess ? '∞ credits' : `${credits} credits`;
    const signOut = document.createElement('button');
    signOut.type = 'button';
    signOut.className = 'text-sm font-medium text-primary';
    signOut.textContent = 'Logout';
    signOut.addEventListener('click', handleSignOut);
    row.append(creditsEl, signOut);
    items.push(row);
  } else {
    const row = document.createElement('div');
    row.className = 'py-3 border-b border-border';
    const guestEl = document.createElement('span');
    guestEl.className = 'text-sm text-text-muted';
    guestEl.textContent = `${guestFreeLeft} free credits left`;
    row.appendChild(guestEl);
    items.push(row);
    items.push(link('Sign in', '/login', MOBILE_LINK_CLASS));
    items.push(link('Register', '/register', MOBILE_REGISTER_CLASS));
  }
  return items;
}

function renderInto(container, items) {
  container.replaceChildren(...items);
}

// ---- Hamburger <-> X animation ----

function animateToggleIcon(toggle, open) {
  const bars = toggle.querySelectorAll('.hb-bar');
  if (bars.length !== 3) return;
  const [top, mid, bottom] = bars;
  if (open) {
    top.style.transform = 'translateY(6px) rotate(45deg)';
    mid.style.opacity = '0';
    bottom.style.transform = 'translateY(-6px) rotate(-45deg)';
  } else {
    top.style.transform = '';
    mid.style.opacity = '1';
    bottom.style.transform = '';
  }
}

// ---- Mobile panel open/close transition ----

function openMobileMenu(menu) {
  menu.classList.remove('hidden');
  menu.style.opacity = '0';
  menu.style.transform = 'translateY(-4px)';
  // Force a paint of the closed state before transitioning to open, or the
  // browser collapses the two states into one and nothing animates.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      menu.style.opacity = '1';
      menu.style.transform = 'translateY(0)';
    });
  });
}

function closeMobileMenu(menu) {
  menu.style.opacity = '0';
  menu.style.transform = 'translateY(-4px)';
  setTimeout(() => menu.classList.add('hidden'), 150);
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
    mobileMenu.style.transition = 'opacity 150ms ease-out, transform 150ms ease-out';
    toggle.addEventListener('click', () => {
      const willOpen = mobileMenu.classList.contains('hidden');
      if (willOpen) {
        openMobileMenu(mobileMenu);
      } else {
        closeMobileMenu(mobileMenu);
      }
      animateToggleIcon(toggle, willOpen);
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

  if (desktopLinks) renderInto(desktopLinks, buildDesktopItems(isAuthed, credits, lifetimeAccess, guestFreeLeft));
  if (mobileMenu) renderInto(mobileMenu, buildMobileItems(isAuthed, credits, lifetimeAccess, guestFreeLeft));
}
