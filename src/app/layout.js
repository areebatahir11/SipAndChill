import './globals.css';

export const metadata = { title: 'Sip&Chill Admin', description: 'Juice & coffee shop management software' };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
