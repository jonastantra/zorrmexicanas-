import type { Metadata, Viewport } from 'next'
import './globals.css'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import AgeVerification from '@/components/AgeVerification'
import CookieConsent from '@/components/CookieConsent'
import { listCategories, listTags } from '@/lib/posts'
import { SITE_CONFIG, themeCss } from '@/lib/site'

const baseUrl = SITE_CONFIG.baseUrl
const defaultTitle = `${SITE_CONFIG.tagline} | ${SITE_CONFIG.name}`

export const metadata: Metadata = {
  title: { default: defaultTitle, template: `%s | ${SITE_CONFIG.name}` },
  description: SITE_CONFIG.description,
  metadataBase: new URL(baseUrl),
  applicationName: SITE_CONFIG.name,
  keywords: ['porno mexicano', 'porno casero mexicano', 'videos mexicanos', 'mexicanas amateur', SITE_CONFIG.name],
  category: 'video',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: SITE_CONFIG.name,
    locale: 'es_MX',
    title: defaultTitle,
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
    name: SITE_CONFIG.name,
    alternateName: [SITE_CONFIG.shortName],
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
        {/* Tema de color por sitio (rose=Zorritas, blue=Lobas), sobre globals.css */}
        <style dangerouslySetInnerHTML={{ __html: themeCss() }} />
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
