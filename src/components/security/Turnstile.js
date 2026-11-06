'use client';
import { useEffect, useRef } from 'react';

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '';

let scriptPromise;
function loadScript() {
  if (typeof window === 'undefined') return Promise.reject();
  if (window.turnstile) return Promise.resolve(window.turnstile);
  scriptPromise ||= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SCRIPT_SRC; s.async = true;
    s.onload = () => resolve(window.turnstile);
    s.onerror = () => { scriptPromise = undefined; reject(new Error('Could not load the security check.')); };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

/**
 * Cloudflare Turnstile widget. Calls onToken(token) when the visitor passes and onToken(null) when the token expires or fails.
 * A token works once: remount the widget (change its `key`) after each use to get a fresh one.
 * Renders nothing when no site key is configured.
 */
export default function Turnstile({ onToken }) {
  const box = useRef(null);
  const cb = useRef(onToken);
  cb.current = onToken;

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return undefined;
    let widgetId;
    let cancelled = false;
    loadScript().then((t) => {
      if (cancelled || !box.current) return;
      widgetId = t.render(box.current, {
        sitekey: TURNSTILE_SITE_KEY,
        callback: (token) => cb.current(token),
        'expired-callback': () => cb.current(null),
        'error-callback': () => cb.current(null),
      });
    }).catch(() => cb.current(null));
    return () => { cancelled = true; if (widgetId !== undefined) window.turnstile?.remove(widgetId); };
  }, []);

  if (!TURNSTILE_SITE_KEY) return null;
  return <div ref={box} className="flex min-h-[65px] justify-center" />;
}
