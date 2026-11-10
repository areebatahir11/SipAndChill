/** A menu item's picture, or a soft tile with its first letter when it has none. Pass `version` (product.imageVersion): it makes a new picture a new URL. */
export default function ProductThumb({ id, name, version, className = '' }) {
  if (version) return <img src={`/api/products/${id}/image?v=${version}`} alt="" width="320" height="240" loading="lazy" decoding="async" className={`object-cover ${className}`} />;
  return <span aria-hidden className={`grid place-items-center bg-peach text-2xl font-semibold text-slate ${className}`}>{[...(name || '?').trim()][0]?.toUpperCase()}</span>;
}
