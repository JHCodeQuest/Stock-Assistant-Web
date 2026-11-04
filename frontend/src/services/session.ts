export const SESSION_CHANGED = 'session-changed';

export function saveSession(token: string, user: unknown) {
  sessionStorage.setItem('token', token);
  sessionStorage.setItem('user', JSON.stringify(user));
  window.dispatchEvent(new Event(SESSION_CHANGED));
}

export function clearSession() {
  sessionStorage.removeItem('token');
  sessionStorage.removeItem('user');
  window.dispatchEvent(new Event(SESSION_CHANGED));
}
