import { get } from './api.js';

export async function requireAuth() {
  const res = await get('/api/auth/me');
  if (!res.ok) {
    window.location.href = '/login';
    return null;
  }
  return res.data;
}

export async function redirectIfAuthed() {
  const res = await get('/api/auth/me');
  if (res.ok) {
    window.location.href = '/';
  }
}
