import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Hong Kong Entity F/S Dashboard',
  description: 'Hong Kong Entity F/S dashboard',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}



