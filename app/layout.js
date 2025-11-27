import './globals.css'

export const metadata = {
  title: 'Avari - Women\'s Coffee Chat Network',
  description: 'Connect and grow through coffee',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
