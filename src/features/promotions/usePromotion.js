'use client';
import { useEffect, useState } from 'react';
import { isRunning, salePriceMinor } from '@/lib/promotions/promotions.mjs';

/**
 * Re-checks the promotion dates every 30 s, so the offer appears at midnight on its first day and disappears
 * at midnight after its last day without anyone reloading the page. `percent` is 0 when no offer is running.
 * This is display only: the server decides the real discount when the order is saved.
 */
export default function usePromotion(promotion) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  const live = !!promotion && isRunning(promotion, new Date(now));
  return {
    promotion: live ? promotion : null,
    upcoming: !!promotion && !live && new Date(promotion.startsAt).getTime() > now ? promotion : null,
    percent: live ? promotion.percent : 0,
    salePrice: (priceMinor) => (live ? salePriceMinor(priceMinor, promotion.percent) : priceMinor),
  };
}
