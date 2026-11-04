// Status is shown by icon + label, not hue alone.
const tones = {
  neutral: 'bg-slate text-sand',
  ok: 'bg-sand text-night before:content-["✓"] before:font-bold',
  off: 'bg-peach text-graphite before:content-["–"] before:font-bold',
};

export default function Pill({ tone = 'neutral', children }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-0.5 text-[13px] font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}
