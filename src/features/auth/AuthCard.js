/** Shared frame of the public login and signup pages: a looping café video behind the brand's diagonal theme. */
export default function AuthCard({ title, sub, children, footer }) {
  return (
    <div className="relative isolate grid min-h-screen place-items-center overflow-hidden bg-night p-6">
      {/* Background video (muted + playsInline so it autoplays on phones too). */}
      <video className="absolute inset-0 -z-20 h-full w-full object-cover" src="/media/auth-bg.mp4" poster="/media/auth-bg.jpg"
        autoPlay muted loop playsInline preload="auto" aria-hidden="true" />
      {/* The same diagonal theme, now see-through so the video shows behind it. */}
      <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(135deg,color-mix(in_srgb,var(--color-night)_88%,transparent)_0%,color-mix(in_srgb,var(--color-slate)_78%,transparent)_45%,color-mix(in_srgb,var(--color-blush)_62%,transparent)_45%,color-mix(in_srgb,var(--color-peach)_72%,transparent)_100%)]" />
      <div className="w-full max-w-[460px] rounded-[20px] bg-white/95 p-8 shadow-2xl ring-1 ring-white/40 backdrop-blur-md">
        <img src="/brand/pearl-logo-light.png" alt="PearlSolutions" width={720} height={484} className="mx-auto mb-3 block h-auto w-[170px]" style={{ width: 170, height: 'auto' }} />
        <h1 className="text-[28px] font-semibold tracking-tight">{title}</h1>
        <p className="text-graphite">{sub}</p>
        {children}
        <p className="mt-5 text-[13px] text-graphite">{footer}</p>
      </div>
    </div>
  );
}
