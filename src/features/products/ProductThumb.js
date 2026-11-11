import ProductArt from '@/features/pos/ProductArt';

/**
 * A menu item's picture. Pass `version` (product.imageVersion): it makes a new picture a new URL.
 * No uploaded picture? A colourful illustration drawn from the item's name (and `category`, when given) takes its place.
 */
export default function ProductThumb({ id, name, version, category = '', className = '' }) {
  if (version) return <img src={`/api/products/${id}/image?v=${version}`} alt="" width="320" height="240" loading="lazy" decoding="async" className={`object-cover ${className}`} />;
  return <ProductArt name={name || ''} category={category} className={className} />;
}
