import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '홍콩법인 F/S',
  description: '홍콩법인 F/S 대시보드',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}




