// Shown instantly while the next page is being prepared on the server, so a click never looks "dead".
export default function Loading() {
  return (
    <div className="animate-pulse" role="status" aria-busy="true" aria-label="Loading">
      <div className="mb-2 h-9 w-56 rounded-xl bg-peach" />
      <div className="mb-6 h-4 w-80 max-w-full rounded-lg bg-peach/70" />
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="h-24 rounded-2xl bg-peach/60" />
        <div className="h-24 rounded-2xl bg-peach/60" />
        <div className="h-24 rounded-2xl bg-peach/60" />
      </div>
      <div className="h-72 rounded-2xl bg-peach/50" />
    </div>
  );
}
