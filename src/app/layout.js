import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';

// One clean, modern UI font for the whole app (served by Next from our own domain: no extra request to Google at run time).
const font = Plus_Jakarta_Sans({ subsets: ['latin'], display: 'swap', variable: '--font-ui' });

export const metadata = { title: 'PearlSolutions', description: 'Orders, menu and stock software for juice and coffee shops' };

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={font.variable}>
      <body>{children}</body>
    </html>
  );
}
