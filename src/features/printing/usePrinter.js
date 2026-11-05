'use client';
import { useEffect, useSyncExternalStore } from 'react';
import * as printer from './printer';

/** Shared printer state for every component on the page (settings are saved per device in localStorage). */
export default function usePrinter() {
  const snap = useSyncExternalStore(printer.subscribe, printer.getSnapshot, printer.getServerSnapshot);
  useEffect(() => { printer.hydrate(); }, []);
  return { ...snap, direct: printer.isDirect(snap.config), api: printer };
}
