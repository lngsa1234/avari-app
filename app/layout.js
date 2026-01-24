import { AuthProvider } from '@/components/AuthProvider'
import './globals.css'

export const metadata = {
  title: 'CircleW - Women\'s Networking Community',
  description: 'Find your circle. Move forward.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='45' fill='none' stroke='%235D4E3C' stroke-width='6' stroke-dasharray='220 60'/%3E%3Ctext x='50' y='62' text-anchor='middle' font-family='Georgia, serif' font-size='40' font-weight='bold' fill='%235D4E3C'%3EW%3C/text%3E%3C/svg%3E" />
      </head>
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}
