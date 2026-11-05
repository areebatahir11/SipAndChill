const base =
  'inline-flex items-center justify-center rounded-[10px] border px-4 py-2 font-medium transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-55';

const variants = {
  secondary: 'border-peach bg-white text-night hover:border-rose hover:bg-blush',
  primary: 'border-slate bg-slate text-blush hover:border-night hover:bg-night',
  accent: 'border-rose bg-rose text-night hover:bg-peach',
  ghost: 'border-peach bg-transparent text-night hover:bg-blush',
  danger: 'border-graphite bg-transparent text-graphite hover:bg-graphite hover:text-blush',
  dangerSolid: 'border-graphite bg-graphite text-blush hover:bg-night',
  sidebar: 'w-full border-taupe bg-transparent text-sand hover:bg-slate',
};
const sizes = { md: '', sm: 'px-3 py-1 text-[13.5px]', lg: 'px-4 py-3 text-base' };

/** Class string shared by <Button> and <ButtonLink> so links can look exactly like buttons. */
export const buttonClass = ({ variant = 'secondary', size = 'md', className = '' } = {}) =>
  `${base} ${variants[variant]} ${sizes[size]} ${className}`;

export default function Button({ variant, size, className, type = 'button', ...props }) {
  return <button type={type} className={buttonClass({ variant, size, className })} {...props} />;
}
