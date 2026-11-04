import { Card, PageHeader, Pill } from '@/components/ui';

/** Placeholder for modules not yet built. No fake data. */
export default function ModulePending({ title, step, children }) {
  return (
    <>
      <PageHeader title={title} sub={`Coming in ${step}`} />
      <Card className="max-w-[560px]">
        <Pill>Not available yet</Pill>
        <p className="mt-3">{children}</p>
        <p className="text-graphite">This screen will use real database records with the same role permissions already set up.</p>
      </Card>
    </>
  );
}
