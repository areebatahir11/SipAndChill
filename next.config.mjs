// Security response headers for every page and API route.
// NOTE: usb=(self) and serial=(self) MUST stay: the receipt printer connects through WebUSB / Web Serial (src/features/printing).
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },                        // the browser must not guess file types
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },                            // nobody else can put the app inside a frame (clickjacking)
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },       // do not leak full URLs (order ids) to other sites
  { key: 'Strict-Transport-Security', value: 'max-age=31536000' },            // HTTPS only (ignored by browsers on plain http://localhost)
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(self), serial=(self)' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false, // do not advertise "X-Powered-By: Next.js"
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
