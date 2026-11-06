import { TERMS_SECTIONS, TERMS_TITLE, TERMS_UPDATED } from '@/lib/legal/terms.mjs';

/** The Terms & Conditions text. Used by the public /terms page and by the acceptance screen. */
export default function TermsDocument() {
  return (
    <article className="grid gap-5">
      <header>
        <h2 className="text-[22px] font-semibold tracking-tight">{TERMS_TITLE}</h2>
        <p className="text-graphite">PearlSolutions · Last updated {TERMS_UPDATED}</p>
      </header>
      {TERMS_SECTIONS.map((s) => (
        <section key={s.heading} className="grid gap-2">
          <h3 className="text-[16px] font-semibold">{s.heading}</h3>
          {s.body.map((p) => <p key={p} className="leading-relaxed">{p}</p>)}
        </section>
      ))}
    </article>
  );
}
