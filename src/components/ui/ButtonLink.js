import Link from 'next/link';
import { buttonClass } from './Button';

/** A navigation link styled like a Button. */
export default function ButtonLink({ variant, size, className, ...props }) {
  return <Link className={buttonClass({ variant, size, className })} {...props} />;
}
