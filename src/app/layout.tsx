import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'Vyapar Samraj — Smart Finance. Stronger Business.',
    template: '%s | Vyapar Samraj',
  },
  description:
    'Vyapar Samraj is a professional finance SaaS platform for managing your business finances smarter.',
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  ),
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="h-full">
      <body
        className="min-h-full bg-white antialiased"
        style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
      >
        {children}
      </body>
    </html>
  )
}
