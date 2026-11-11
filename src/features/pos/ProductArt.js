import { useId } from 'react';

/**
 * Menu pictures that need no upload: when an item has no photo, the tile draws a colourful illustration
 * chosen from the item's name (and its category) - an orange juice looks orange, a latte looks like a latte.
 * Pure SVG, no images to load, same result on server and browser.
 */

// bg1/bg2 = the tile's colour field, liquid = what's in the cup, fruit = slice/garnish colour.
const THEMES = {
  orange:  { bg1: '#FFB347', bg2: '#FF7A1A', liquid: '#FF8C00', fruit: '#FFD27A' },
  pink:    { bg1: '#FF9EB5', bg2: '#FF4D78', liquid: '#E8225A', fruit: '#FFC2D1' },
  green:   { bg1: '#A8E063', bg2: '#35B96B', liquid: '#4CAF50', fruit: '#D6F5A3' },
  yellow:  { bg1: '#FFE680', bg2: '#FFB800', liquid: '#FFC62E', fruit: '#FFF3B0' },
  purple:  { bg1: '#C59BFF', bg2: '#7A4DFF', liquid: '#6A3DE0', fruit: '#E3D1FF' },
  brown:   { bg1: '#D9A47A', bg2: '#8A5532', liquid: '#5B3420', fruit: '#F3DFC8' },
  cream:   { bg1: '#FFE3C8', bg2: '#F2A5A0', liquid: '#F8D9B8', fruit: '#FFF6EC' },
  aqua:    { bg1: '#7EE0F5', bg2: '#2A9FE0', liquid: '#22B8E6', fruit: '#C9F3FF' },
};

const HAS = (text, words) => words.some((w) => text.includes(w));

function themeFor(text, seed) {
  if (HAS(text, ['orange', 'mango', 'carrot', 'papaya', 'peach', 'apricot', 'pineapple', 'tang'])) return THEMES.orange;
  if (HAS(text, ['strawberry', 'watermelon', 'pomegranate', 'cherry', 'rose', 'berry blast', 'raspberry', 'guava', 'tomato'])) return THEMES.pink;
  if (HAS(text, ['lime', 'mint', 'kiwi', 'green', 'apple', 'avocado', 'pista', 'matcha', 'cucumber', 'mojito', 'sugarcane', 'ganna'])) return THEMES.green;
  if (HAS(text, ['banana', 'vanilla', 'lemon', 'lemonade', 'melon', 'honey', 'corn'])) return THEMES.yellow;
  if (HAS(text, ['blueberry', 'grape', 'jamun', 'falsa', 'fig', 'plum', 'blackcurrant', 'lavender', 'taro'])) return THEMES.purple;
  if (HAS(text, ['coffee', 'mocha', 'espresso', 'americano', 'cappuccino', 'latte', 'macchiato', 'chocolate', 'choco', 'oreo', 'brownie', 'caramel', 'cocoa', 'nutella', 'tea', 'chai', 'karak', 'cola', 'coke', 'pepsi'])) return THEMES.brown;
  if (HAS(text, ['milk', 'lassi', 'shake', 'cream', 'kulfi', 'falooda', 'ice cream', 'sundae', 'badam', 'rabri'])) return THEMES.cream;
  if (HAS(text, ['water', 'soda', 'blue', 'slush', 'ice', 'cooler', 'curacao'])) return THEMES.aqua;
  const all = Object.values(THEMES);
  return all[seed % all.length];
}

function kindFor(text) {
  if (HAS(text, ['ice cream', 'icecream', 'kulfi', 'sundae', 'cone', 'gelato', 'scoop', 'falooda'])) return 'cone';
  if (HAS(text, ['burger', 'sandwich', 'club', 'wrap', 'zinger', 'sub', 'pizza', 'fries', 'nugget'])) return 'burger';
  if (HAS(text, ['cake', 'brownie', 'pastry', 'waffle', 'donut', 'doughnut', 'cookie', 'cheesecake', 'dessert'])) return 'cake';
  if (HAS(text, ['iced', 'cold coffee', 'frappe', 'frappuccino', 'cold brew', 'bubble', 'boba'])) return 'iced';
  if (HAS(text, ['tea', 'chai', 'karak', 'coffee', 'espresso', 'americano', 'cappuccino', 'latte', 'mocha', 'macchiato', 'hot chocolate', 'kehwa', 'green tea'])) return 'mug';
  return 'glass';
}

export function seedOf(s) {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return h;
}

/** A single emoji for a category button ("Fresh Juices" -> 🍊). Falls back to a generic cup. */
export function categoryEmoji(name = '') {
  const t = name.toLowerCase();
  if (HAS(t, ['juice', 'fresh', 'fruit'])) return '🍊';
  if (HAS(t, ['smoothie', 'shake', 'milkshake'])) return '🥤';
  if (HAS(t, ['coffee', 'espresso', 'latte', 'hot'])) return '☕';
  if (HAS(t, ['tea', 'chai'])) return '🍵';
  if (HAS(t, ['ice cream', 'dessert', 'sweet', 'kulfi'])) return '🍨';
  if (HAS(t, ['cake', 'bake', 'pastry', 'waffle'])) return '🍰';
  if (HAS(t, ['burger', 'sandwich', 'snack', 'fast', 'fries', 'pizza'])) return '🍔';
  if (HAS(t, ['cold', 'iced', 'soda', 'drink', 'beverage', 'mocktail'])) return '🧋';
  if (HAS(t, ['salad', 'healthy', 'bowl'])) return '🥗';
  return '🍹';
}

/** The illustration itself. `name` + `category` pick the drawing and the colours; same name = same picture, always. */
export default function ProductArt({ name = '', category = '', className = '' }) {
  const uid = useId().replace(/:/g, '');
  const text = `${name} ${category}`.toLowerCase();
  const seed = seedOf(name);
  const t = themeFor(text, seed);
  const kind = kindFor(text);
  const g = `g${uid}`;
  const clip = `c${uid}`;

  return (
    <svg viewBox="0 0 200 150" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false" className={className}>
      <defs>
        <linearGradient id={g} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={t.bg1} />
          <stop offset="1" stopColor={t.bg2} />
        </linearGradient>
        <clipPath id={clip}>
          {kind === 'glass' && <path d="M68 38H132L124 120Q123 126 117 126H83Q77 126 76 120Z" />}
          {kind === 'iced' && <path d="M72 58H128L121 122Q120 128 114 128H86Q80 128 79 122Z" />}
          {kind === 'mug' && <path d="M62 68H126V104Q126 124 106 124H82Q62 124 62 104Z" />}
        </clipPath>
      </defs>

      <rect width="200" height="150" fill={`url(#${g})`} />
      {/* soft sun + scattered bubbles so the field isn't flat */}
      <circle cx="162" cy="30" r="46" fill="#fff" opacity=".14" />
      <circle cx="30" cy="124" r="34" fill="#000" opacity=".06" />
      <circle cx="28" cy="40" r="5" fill="#fff" opacity=".35" />
      <circle cx="176" cy="104" r="7" fill="#fff" opacity=".28" />
      <circle cx="46" cy="76" r="3" fill="#fff" opacity=".4" />
      <ellipse cx="100" cy="134" rx="46" ry="6" fill="#000" opacity=".16" />

      {kind === 'glass' && (
        <g>
          <g clipPath={`url(#${clip})`}>
            <rect x="60" y="38" width="80" height="90" fill="#fff" opacity=".28" />
            <path d="M60 56Q80 49 100 56T140 56V130H60Z" fill={t.liquid} />
            <rect x="60" y="86" width="80" height="44" fill="#000" opacity=".1" />
            <rect x="82" y="64" width="17" height="17" rx="4" fill="#fff" opacity=".32" transform="rotate(-12 90 72)" />
            <rect x="106" y="82" width="15" height="15" rx="4" fill="#fff" opacity=".28" transform="rotate(14 113 89)" />
            <circle cx="94" cy="104" r="3.5" fill="#fff" opacity=".4" />
            <circle cx="108" cy="112" r="2.5" fill="#fff" opacity=".4" />
          </g>
          <path d="M72 44L75 112" stroke="#fff" strokeWidth="5" strokeLinecap="round" opacity=".5" />
          <path d="M68 38H132L124 120Q123 126 117 126H83Q77 126 76 120Z" fill="none" stroke="#fff" strokeWidth="3" strokeLinejoin="round" opacity=".9" />
          <path d="M110 16L100 86" stroke="#fff" strokeWidth="7" strokeLinecap="round" />
          <path d="M110 16L100 86" stroke={t.bg2} strokeWidth="7" strokeLinecap="round" strokeDasharray="6 7" />
          <g transform="translate(132 40) rotate(18)">
            <circle r="16" fill={t.fruit} />
            <circle r="12" fill={t.liquid} opacity=".85" />
            <path d="M0 -12V12M-12 0H12M-8.5 -8.5L8.5 8.5M8.5 -8.5L-8.5 8.5" stroke="#fff" strokeWidth="1.6" opacity=".8" />
          </g>
        </g>
      )}

      {kind === 'iced' && (
        <g>
          <path d="M104 6L110 6L104 54" stroke="#fff" strokeWidth="7" strokeLinecap="round" fill="none" />
          <g clipPath={`url(#${clip})`}>
            <rect x="66" y="58" width="68" height="74" fill="#fff" opacity=".3" />
            <rect x="66" y="76" width="68" height="56" fill={t.liquid} />
            <rect x="66" y="58" width="68" height="20" fill={t.fruit} opacity=".95" />
            <path d="M66 78Q84 70 100 78T134 78V84H66Z" fill={t.fruit} />
            <rect x="82" y="92" width="16" height="16" rx="4" fill="#fff" opacity=".3" transform="rotate(-10 90 100)" />
            <rect x="106" y="104" width="14" height="14" rx="4" fill="#fff" opacity=".26" transform="rotate(12 113 111)" />
          </g>
          <path d="M72 58H128L121 122Q120 128 114 128H86Q80 128 79 122Z" fill="none" stroke="#fff" strokeWidth="3" strokeLinejoin="round" opacity=".9" />
          <path d="M70 42Q100 30 130 42V56H70Z" fill="#fff" opacity=".85" />
          <rect x="66" y="54" width="68" height="7" rx="3.5" fill="#fff" />
          <rect x="82" y="96" width="36" height="16" rx="4" fill={t.bg2} opacity=".9" />
        </g>
      )}

      {kind === 'mug' && (
        <g>
          <path d="M82 42Q74 34 82 26T82 10" stroke="#fff" strokeWidth="4" strokeLinecap="round" fill="none" opacity=".75" />
          <path d="M100 46Q92 38 100 30T100 14" stroke="#fff" strokeWidth="4" strokeLinecap="round" fill="none" opacity=".75" />
          <path d="M118 42Q110 34 118 26T118 10" stroke="#fff" strokeWidth="4" strokeLinecap="round" fill="none" opacity=".75" />
          <path d="M126 78H138Q154 78 154 94T138 110H124" fill="none" stroke="#fff" strokeWidth="9" strokeLinecap="round" />
          <path d="M62 68H126V104Q126 124 106 124H82Q62 124 62 104Z" fill="#fff" />
          <ellipse cx="94" cy="68" rx="32" ry="8" fill={t.liquid} />
          <ellipse cx="94" cy="67" rx="17" ry="4" fill={t.fruit} opacity=".9" />
          <ellipse cx="100" cy="128" rx="52" ry="7" fill="#fff" opacity=".85" />
        </g>
      )}

      {kind === 'cone' && (
        <g>
          <path d="M74 80L100 134L126 80Z" fill="#E8A752" />
          <path d="M82 92L112 92M88 106L106 106M80 80L106 126M94 80L110 112M108 80L96 106M120 80L100 128" stroke="#C57F2E" strokeWidth="2.2" opacity=".7" />
          <circle cx="100" cy="68" r="28" fill={t.fruit} />
          <path d="M72 70Q72 84 80 84Q84 94 90 84Q96 92 102 84Q110 94 114 84Q128 84 128 70Z" fill={t.fruit} />
          <circle cx="100" cy="48" r="24" fill={t.liquid} />
          <path d="M80 52Q84 66 92 56Q96 68 102 58Q110 70 116 56Q120 62 122 54L118 40H82Z" fill={t.liquid} />
          <circle cx="100" cy="22" r="7" fill="#E5173F" />
          <path d="M100 16Q104 6 112 4" stroke="#3a7d2c" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <circle cx="92" cy="44" r="3" fill="#fff" opacity=".5" />
        </g>
      )}

      {kind === 'burger' && (
        <g>
          <path d="M58 70Q58 34 100 34T142 70Z" fill="#E59A3C" />
          <circle cx="82" cy="52" r="2.4" fill="#FFE9B8" /><circle cx="100" cy="46" r="2.4" fill="#FFE9B8" /><circle cx="118" cy="54" r="2.4" fill="#FFE9B8" /><circle cx="108" cy="60" r="2.4" fill="#FFE9B8" />
          <path d="M54 70Q62 82 72 72Q82 84 92 72Q102 84 112 72Q122 84 132 72Q140 80 146 70V74H54Z" fill="#59B84A" />
          <path d="M60 78H140L134 90H66Z" fill="#FFC83D" />
          <rect x="58" y="88" width="84" height="14" rx="7" fill="#6B3B22" />
          <path d="M58 106H142Q142 124 100 124T58 106Z" fill="#E59A3C" />
        </g>
      )}

      {kind === 'cake' && (
        <g>
          <path d="M54 110L146 110L146 88L54 88Z" fill={t.fruit} />
          <path d="M54 88L146 88L130 52L70 52Z" fill={t.liquid} />
          <path d="M70 52L130 52L146 88L54 88Z" fill="none" />
          <rect x="54" y="98" width="92" height="5" fill={t.liquid} opacity=".55" />
          <path d="M60 52Q70 66 82 52Q94 68 106 52Q118 66 130 52V46H60Z" fill="#fff" opacity=".92" />
          <circle cx="100" cy="38" r="9" fill="#E5173F" />
          <path d="M100 30Q103 20 111 18" stroke="#3a7d2c" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <rect x="50" y="110" width="100" height="9" rx="4.5" fill="#fff" opacity=".9" />
        </g>
      )}
    </svg>
  );
}
