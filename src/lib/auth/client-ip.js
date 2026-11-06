/** Best-effort network address of the caller. On Vercel the platform headers are set by the edge, so they cannot be forged by the client. */
export function clientIp(request) {
  const h = request.headers;
  const ip = h.get('x-vercel-forwarded-for') || h.get('x-real-ip') || h.get('x-forwarded-for')?.split(',')[0] || '';
  return ip.trim() || null;
}
