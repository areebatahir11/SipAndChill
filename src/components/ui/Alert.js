const tones = {
  error: 'border-l-4 border-graphite bg-peach text-night font-medium',
  success: 'bg-sand text-night',
};

export default function Alert({ tone = 'error', children, className = '' }) {
  return (
    <p role={tone === 'error' ? 'alert' : 'status'} className={`m-0 rounded-[10px] px-3.5 py-2.5 ${tones[tone]} ${className}`}>
      <span className="mr-2.5 inline-grid size-5 place-items-center rounded-full bg-night text-xs font-bold text-sand">
        {tone === 'error' ? '!' : '✓'}
      </span>
      {children}
    </p>
  );
}
