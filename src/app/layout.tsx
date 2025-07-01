import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Navbar from '@/components/Navbar'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Manage TikTok scraper workers and queue videos for scraping',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="min-h-screen bg-gray-50">
          <Navbar />
          <main className="py-6">
            <div className="mx-auto max-w-7xl px-6 lg:px-8">
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  )
} 