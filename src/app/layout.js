import './globals.css';

export const metadata = { title: 'PearlSolutions', description: 'Orders, menu and stock software for juice and coffee shops' };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
