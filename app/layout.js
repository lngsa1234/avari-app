import { AuthProvider } from '@/components/AuthProvider'
import './globals.css'

export const metadata = {
  title: 'CircleW - Women\'s Networking Community',
  description: 'Find your circle. Move forward.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='40' fill='none' stroke='%235C4033' stroke-width='5' stroke-dasharray='189 63' stroke-linecap='round' transform='rotate(-30 50 50)'/%3E%3Cpath d='M 28 42 L 36 66 L 50 48 L 64 66 L 72 42' fill='none' stroke='%235C4033' stroke-width='8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Deferred: migrate to `next/font/google` for self-hosting + CLS avoidance.
            Warning is written for Pages Router; as the root layout, this does load
            globally. Safe to defer until we touch typography. */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Lora:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600;1,700&family=Playfair+Display:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body suppressHydrationWarning>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}
