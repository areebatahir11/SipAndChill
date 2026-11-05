/** Confirms, ends the session and returns to the login page. Shared by both sidebars. */
export async function signOut() {
  if (!confirm('Are you sure you want to log out?')) return;
  await fetch('/api/auth/logout', { method: 'POST' });
  location.href = '/login';
}
