import type { Metadata, Viewport } from 'next'
import { cookies } from 'next/headers'
// Geist auto-hospedada (@fontsource): o pacote `geist` exige o `next` instalado (e o React 18 dele) e usa next/font.
import '@fontsource-variable/geist'
import '@fontsource-variable/geist-mono'
// URL com hash da variante latina da Geist, a mesma que o CSS do @fontsource pede: vai num <link rel=preload> (LCP sem troca de fonte)
import geistLatina from '@fontsource-variable/geist/files/geist-latin-wght-normal.woff2?url'
import './globals.css'
import { ToastProvider } from '@/components/ui/toast'
import { DESCRICAO_PADRAO, IMAGEM_OG, NOME, SLOGAN, absoluta } from '@/lib/seo'
import { ORIGEM_SITE } from '@/lib/site'
import { COR_BARRA, SCRIPT_TEMA, temaDoCookie } from '@/lib/tema'

/** Verificação de propriedade do site (Search Console e Bing Webmaster) por variável de build; sem ela, nenhuma meta sai. */
const VERIFICACAO = { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION, bing: process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION }

/**
 * Padrão de toda página: noindex (produto privado; nada do app, de /p ou de /criar entra em buscadores). As páginas
 * públicas (landing, /precos, /apresentacao-com-ia, /signup) liberam a indexação com metadadosPagina() de lib/seo.ts.
 */
export const metadata: Metadata = {
  metadataBase: new URL(ORIGEM_SITE),
  title: { default: `${NOME} — ${SLOGAN.toLowerCase()}`, template: `%s · ${NOME}` },
  description: DESCRICAO_PADRAO,
  applicationName: NOME,
  robots: { index: false, follow: false },
  openGraph: { type: 'website', siteName: NOME, locale: 'pt_BR', url: ORIGEM_SITE, title: `${NOME} — ${SLOGAN.toLowerCase()}`, description: DESCRICAO_PADRAO, images: [{ ...IMAGEM_OG, url: absoluta(IMAGEM_OG.url) }] },
  twitter: { card: 'summary_large_image', title: `${NOME} — ${SLOGAN.toLowerCase()}`, description: DESCRICAO_PADRAO, images: [absoluta(IMAGEM_OG.url)] },
  ...(VERIFICACAO.google || VERIFICACAO.bing
    ? { verification: { ...(VERIFICACAO.google ? { google: VERIFICACAO.google } : {}), ...(VERIFICACAO.bing ? { other: { 'msvalidate.01': VERIFICACAO.bing } } : {}) } }
    : {}),
}

// theme-color por tema do sistema; com tema escolhido, lib/tema.ts (e o script abaixo) reescreve as duas metas
export const viewport: Viewport = {
  width: 'device-width', initialScale: 1, viewportFit: 'cover',
  themeColor: [{ media: '(prefers-color-scheme: light)', color: COR_BARRA.claro }, { media: '(prefers-color-scheme: dark)', color: COR_BARRA.escuro }],
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // tema salvo no cookie: o servidor já manda o <html data-tema> certo (auto fica sem atributo: o CSS segue o sistema)
  const tema = temaDoCookie((await cookies()).get('tema')?.value)
  return (
    <html lang="pt-BR" suppressHydrationWarning {...(tema === 'auto' ? {} : { 'data-tema': tema, 'data-tema-pref': tema })}>
      <head>
        <link rel="preload" as="font" type="font/woff2" href={geistLatina} crossOrigin="anonymous" />
        <meta name="color-scheme" content={tema === 'auto' ? 'light dark' : tema === 'claro' ? 'only light' : 'dark'} />
        {/* favicon: o símbolo da marca em SVG (public/favicon.svg); o PNG da tela inicial do iOS sai de scripts/gerar-favicon.mjs */}
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        {/* tema aplicado antes da pintura (sem flash): localStorage → cookie → automático (lib/tema.ts) */}
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} />
      </head>
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  )
}
