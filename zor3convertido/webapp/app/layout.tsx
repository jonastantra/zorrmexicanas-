import type { Metadata, Viewport } from 'next'
import './globals.css'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import AgeVerification from '@/components/AgeVerification'
import CookieConsent from '@/components/CookieConsent'
import { listCategories, listTags } from '@/lib/posts'
import { SITE_CONFIG } from '@/lib/site'

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

export const metadata: Metadata = {
  title: { default: 'Porno mexicano casero y videos amateur | Zorritas Mexicanas', template: '%s | Zorritas Mexicanas' },
  description: SITE_CONFIG.description,
  metadataBase: new URL(baseUrl),
  applicationName: 'Zorritas Mexicanas',
  keywords: ['porno mexicano', 'porno casero mexicano', 'videos mexicanos', 'mexicanas amateur', 'zorras mexicanas', 'Zorritas Mexicanas'],
  category: 'video',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: 'Zorritas Mexicanas',
    locale: 'es_MX',
    title: 'Porno mexicano casero y videos amateur | Zorritas Mexicanas',
    description: SITE_CONFIG.description,
  },
  twitter: { card: 'summary_large_image' },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-video-preview': -1,
      'max-snippet': -1,
    },
  },
}

export const viewport: Viewport = {
  themeColor: '#09090b',
  colorScheme: 'dark',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const categories = listCategories({ minCount: 100, limit: 30 })
  const tags = listTags({ minCount: 100, limit: 80 })
  const websiteJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Zorritas Mexicanas',
    alternateName: ['Zorras Mexicanas', 'Zorritas', 'ZorritasMexicanas'],
    description: SITE_CONFIG.description,
    url: baseUrl,
    inLanguage: 'es-MX',
    isFamilyFriendly: false,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${baseUrl.replace(/\/$/, '')}/buscar?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  }

  return (
    <html lang="es-MX">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var c=document.cookie.indexOf('zm_age_verified=1')!==-1;var l=localStorage.getItem('zm_age_verified')==='1';if(c||l)document.documentElement.classList.add('age-verified')}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
        <AgeVerification />
        <Header categories={categories} />
        <main className="site-main">{children}</main>
        <Footer categories={categories} tags={tags} />
        <CookieConsent />
      </body>
    </html>
  )
}
