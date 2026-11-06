/** Shared frame of the public login and signup pages. */
export default function AuthCard({ title, sub, children, footer }) {
  return (
    <div className="grid min-h-screen place-items-center bg-[linear-gradient(135deg,var(--color-night)_0%,var(--color-slate)_45%,var(--color-blush)_45%,var(--color-peach)_100%)] p-6">
      <div className="w-full max-w-[460px] rounded-[20px] bg-white p-8 shadow-2xl">
        {/* Light-background version of the PearlSolutions logo (transparent PNG; the dark one is used on the sidebar). */}
        <img src="/brand/pearl-logo-light.png" alt="PearlSolutions" width={720} height={484} className="mx-auto mb-3 block h-auto w-[170px]" style={{ width: 170, height: 'auto' }} />
        <h1 className="text-[28px] font-semibold tracking-tight">{title}</h1>
        <p className="text-graphite">{sub}</p>
        {children}
        <p className="mt-5 text-[13px] text-graphite">{footer}</p>
      </div>
    </div>
  );
}
