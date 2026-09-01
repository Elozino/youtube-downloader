import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'Self Hosted Media Download',
  description: 'Download YouTube videos, audio, and playlists you own or may use.',
  icons: {
    icon: '/download-tab-logo.svg',
    shortcut: '/download-tab-logo.svg',
  },
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
