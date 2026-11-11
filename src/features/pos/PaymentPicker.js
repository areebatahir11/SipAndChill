'use client';
import { useState } from 'react';
import { Pill } from '@/components/ui';
import { fromMinor } from '@/lib/money.mjs';
import { money } from '@/lib/format';
import { ONLINE_METHODS, methodLabel } from '@/lib/payments.mjs';
import { typedOnlineMinor } from '@/lib/payment-form.mjs';

/**
 * "How did the customer pay?" - Cash and/or Online (JazzCash, Easypaisa, Bank transfer).
 * Both on = a split payment. Used on the counter (dark order panel) and in the "Take payment" dialog (light).
 * It only edits the form; the numbers and rules come from readPayForm() (lib/payment-form.mjs), passed in as `result`.
 */

const STATUS_PILL = { PAID: ['ok', 'Paid'], PARTIAL: ['neutral', 'Partially paid'], UNPAID: ['alert', 'Unpaid'] };

const TONES = {
  dark: {
    label: 'text-sand', muted: 'text-sand/80', card: 'bg-slate/70',
    field: 'border-slate bg-night text-white placeholder:text-sand/40 focus:border-rose',
    chip: 'bg-slate text-white hover:bg-rose hover:text-night',
    on: 'bg-rose text-night', off: 'bg-slate text-white hover:bg-slate/70',
    error: 'bg-rose/15 text-rose',
  },
  light: {
    label: 'text-night', muted: 'text-graphite', card: 'bg-blush/70',
    field: 'border-peach bg-white text-night placeholder:text-graphite/50 focus:border-night',
    chip: 'bg-blush text-night hover:bg-rose',
    on: 'bg-night text-white', off: 'bg-blush text-night ring-1 ring-peach hover:bg-peach/40',
    error: 'bg-rose/25 text-night',
  },
};

// Logos live in public/payment/ (see README.txt there). No white tile behind them: transparent PNGs sit straight on the button.
// Easypaisa's "e" is black, so on a dark background the reversed (white) file is used.
const LOGO = { JAZZCASH: '/payment/jazzcash.png', EASYPAISA: '/payment/easypaisa.png' };
const LOGO_ON_DARK = { EASYPAISA: '/payment/easypaisa-light.png' };

function Badge({ method, onDarkBg = false, size = 'lg' }) {
  const [missing, setMissing] = useState(false);
  const box = size === 'lg' ? 'h-10 w-10' : 'h-8 w-8';
  if (method === 'BANK_TRANSFER' || missing) {
    return <span aria-hidden className={`grid shrink-0 place-items-center leading-none ${box} ${size === 'lg' ? 'text-[2rem]' : 'text-2xl'}`}>{method === 'BANK_TRANSFER' ? '🏦' : '📱'}</span>;
  }
  const src = (onDarkBg && LOGO_ON_DARK[method]) || LOGO[method];
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" aria-hidden width="40" height="40" className={`shrink-0 object-contain ${box}`} onError={() => setMissing(true)} />;
}

export default function PaymentPicker({ form, setForm, dueMinor, result, tone = 'dark' }) {
  const t = TONES[tone];
  const patch = (p) => setForm((f) => ({ ...f, ...p }));
  const patchMethod = (m, p) => setForm((f) => ({ ...f, methods: { ...f.methods, [m]: { ...f.methods[m], ...p } } }));
  const picked = ONLINE_METHODS.filter((m) => form.methods[m].on);
  const sole = form.online && picked.length === 1 && (!form.cash || form.cashAmount.trim() === ''); // one online method and no cash typed: its amount defaults to the full due
  const cashDueMinor = Math.max(dueMinor - typedOnlineMinor(form), 0);
  const quick = [['Exact', cashDueMinor], ...[500, 1000, 5000].map((v) => [String(v), v * 100])];
  const { pay, payments, error } = result;
  const hasRows = payments.length > 0;
  const inputCls = `w-full rounded-2xl border-2 px-4 py-3 text-lg font-bold focus:outline-none ${t.field}`;

  return (
    <div className="grid gap-3">
      <div className={`text-sm font-semibold ${t.label}`}>How did the customer pay?</div>
      <div className="grid grid-cols-2 gap-2" role="group" aria-label="Payment type">
        <button type="button" aria-pressed={form.cash} onClick={() => patch({ cash: !form.cash })}
          className={`flex cursor-pointer items-center justify-center gap-2 rounded-2xl px-3 py-3 font-bold transition-colors ${form.cash ? t.on : t.off}`}>
          <span aria-hidden className="text-xl">💵</span>Cash
        </button>
        <button type="button" aria-pressed={form.online} onClick={() => patch(form.online ? { online: false } : { online: true, ...(form.cashAmount.trim() === '' ? { cash: false } : {}) })}
          className={`flex cursor-pointer items-center justify-center gap-2 rounded-2xl px-3 py-3 font-bold transition-colors ${form.online ? t.on : t.off}`}>
          <span aria-hidden className="text-xl">📱</span>Online
        </button>
      </div>
      {form.cash && form.online && <p className={`-mt-1 text-[13px] ${t.muted}`}>Cash and online together: a split payment.</p>}

      {form.cash && (
        <div className="grid gap-2">
          <label className={`grid gap-1.5 text-sm font-semibold ${t.label}`}>Cash received (Rs)
            <input inputMode="decimal" autoComplete="off" placeholder="0" value={form.cashAmount} onChange={(e) => patch({ cashAmount: e.target.value })} className={`${inputCls} text-2xl`} />
          </label>
          <div className="flex flex-wrap gap-2">
            {quick.map(([label, v]) => (
              <button type="button" key={label} onClick={() => patch({ cashAmount: fromMinor(v).replace(/\.00$/, '') })} className={`cursor-pointer rounded-full px-4 py-1.5 text-sm font-semibold ${t.chip}`}>
                {label === 'Exact' ? 'Exact' : money(label)}
              </button>
            ))}
            <button type="button" onClick={() => patch({ cashAmount: '' })} className={`cursor-pointer rounded-full px-3 py-1.5 text-sm ${t.muted} hover:underline`}>Clear</button>
          </div>
        </div>
      )}

      {form.online && (
        <div className="grid gap-2.5">
          <div className={`text-sm font-semibold ${t.label}`}>Paid through</div>
          <div className="grid grid-cols-3 gap-2" role="group" aria-label="Online method">
            {ONLINE_METHODS.map((m) => (
              <button type="button" key={m} aria-pressed={form.methods[m].on} onClick={() => patchMethod(m, { on: !form.methods[m].on })}
                className={`flex cursor-pointer flex-col items-center gap-1.5 rounded-2xl px-2 py-3 text-center text-[13px] font-bold leading-tight transition-colors ${form.methods[m].on ? t.on : t.off}`}>
                <Badge method={m} onDarkBg={tone === 'dark' ? !form.methods[m].on : form.methods[m].on} />{methodLabel(m)}
              </button>
            ))}
          </div>
          {picked.map((m) => (
            <div key={m} className={`grid gap-2 rounded-2xl p-3 ${t.card}`}>
              <div className={`flex items-center gap-2 font-bold ${t.label}`}><Badge method={m} size="sm" onDarkBg={tone === 'dark'} />{methodLabel(m)}</div>
              <label className={`grid gap-1 text-[13px] font-semibold ${t.label}`}>Amount (Rs)
                <input inputMode="decimal" autoComplete="off" placeholder={sole ? `Full amount (${money(fromMinor(dueMinor))})` : 'Amount'} value={form.methods[m].amount} onChange={(e) => patchMethod(m, { amount: e.target.value })} className={inputCls} />
              </label>
              <label className={`grid gap-1 text-[13px] font-semibold ${t.label}`}><span>Transaction ID <span className="font-normal opacity-70">(optional)</span></span>
                <input autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={40} placeholder="e.g. 12345678" value={form.methods[m].reference} onChange={(e) => patchMethod(m, { reference: e.target.value })} className={`${inputCls} uppercase tracking-wide placeholder:normal-case placeholder:tracking-normal`} />
              </label>
            </div>
          ))}
        </div>
      )}

      {error && <p role="alert" className={`rounded-xl px-3 py-2 text-sm font-semibold ${t.error}`}>{error}</p>}

      {pay && (
        <dl className={`grid gap-1.5 rounded-2xl p-3 ${t.card} ${tone === 'dark' ? 'text-white' : 'text-night'}`}>
          {hasRows && payments.map((p) => (
            <div key={p.method} className="flex items-center justify-between gap-3 text-sm">
              <dt className="opacity-75">{methodLabel(p.method)}</dt><dd className="font-semibold">{money(fromMinor(p.amountMinor))}</dd>
            </div>
          ))}
          {form.cash && <div className="flex items-center justify-between gap-3"><dt className="opacity-75">Change Returned</dt><dd className="text-xl font-bold">{money(fromMinor(pay.changeMinor))}</dd></div>}
          <div className="flex items-center justify-between gap-3"><dt className="opacity-75">Outstanding Amount</dt><dd className="font-semibold">{money(fromMinor(pay.outstandingMinor))}</dd></div>
          <div className="flex items-center justify-between gap-3"><dt className="opacity-75">Payment Status</dt><dd><Pill tone={STATUS_PILL[pay.status][0]}>{STATUS_PILL[pay.status][1]}</Pill></dd></div>
        </dl>
      )}
    </div>
  );
}
