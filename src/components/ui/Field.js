const inputClass =
  'w-full rounded-[10px] border border-taupe bg-white px-3 py-2.5 font-normal text-night placeholder:text-graphite/60 focus:border-slate focus:outline-none focus:ring-4 focus:ring-peach';

export const Input = ({ className = '', ...props }) => <input className={`${inputClass} ${className}`} {...props} />;

export const Select = ({ className = '', children, ...props }) => (
  <select className={`${inputClass} ${className}`} {...props}>{children}</select>
);

/** Label + control. Usage: <Field label="Email"><Input .../></Field> */
export function Field({ label, children }) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-slate">
      {label}
      {children}
    </label>
  );
}

export const Form = ({ className = '', ...props }) => <form className={`grid gap-4 ${className}`} {...props} />;
