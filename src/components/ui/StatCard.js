import Card from './Card';

/** One headline number. `hint` is small supporting text under it. */
export default function StatCard({ label, value, hint }) {
  return (
    <Card>
      <p className="text-[13px] font-medium text-graphite">{label}</p>
      <p className="mt-1 text-3xl font-semibold tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-[13px] text-graphite">{hint}</p>}
    </Card>
  );
}
