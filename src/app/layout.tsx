import type { Metadata, Viewport } from 'next'
import { Fraunces, Inter } from 'next/font/google'
import './globals.css'
import { Suspense } from 'react'
import { NavigationProgress } from '@/components/layout/NavigationProgress'
import { ServiceWorkerRegistration } from './service-worker-registration'

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL('https://adik-akak-bite.vercel.app'),
  title: 'AdikAkak Bite — Business Control Centre',
  description: 'Know what to do right now. Track orders, sales, inventory and content for your dessert business.',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icons/iconAdik-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/icons/iconAdik-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/iconAdik192x192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: '/icons/iconAdik-180x180.png',
  },
  openGraph: {
    title: 'AdikAkak Bite — Business Control Centre',
    description: 'Know what to do right now. Track orders, sales, inventory and content for your dessert business.',
    url: 'https://adik-akak-bite.vercel.app/today',
    siteName: 'AdikAkak Bite',
    images: [
      {
        url: '/icons/iconAdik512x512.png',
        width: 512,
        height: 512,
        alt: 'AdikAkak Bite app icon',
      },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AdikAkak Bite — Business Control Centre',
    description: 'Know what to do right now. Track orders, sales, inventory and content for your dessert business.',
    images: ['/icons/iconAdik512x512.png'],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'AdikAkak Bite',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#FFF9E9',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable}`}>
      <body className="font-body">
        {/* useSearchParams() inside needs a Suspense boundary to keep pages static-renderable. */}
        <Suspense fallback={null}>
          <NavigationProgress />
        </Suspense>
        {children}
        <ServiceWorkerRegistration />
      </body>
    </html>
  )
}
