export default function Card({ className = '', children, ...props }) {
  return (
    <div className={`rounded-2xl border border-peach bg-white p-5 shadow-sm ${className}`} {...props}>
      {children}
    </div>
  );
}
