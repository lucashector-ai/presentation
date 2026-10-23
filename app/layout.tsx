import type { Metadata, Viewport } from 'next'
import { cookies } from 'next/headers'
// Geist auto-hospedada (@fontsource): o pacote `geist` exige o `next` instalado (e o React 18 dele) e usa next/font.
import '@fontsource-variable/geist'
import '@fontsource-variable/geist-mono'
import './globals.css'
import { ToastProvider } from '@/components/ui/toast'
import { COR_BARRA, SCRIPT_TEMA, temaDoCookie } from '@/lib/tema'

export const metadata: Metadata = {
  title: { default: 'Mostra — apresentações para quem cria', template: '%s · Mostra' },
  description: 'Crie, apresente e compartilhe experiências visuais que vão além dos slides — com movimento, interações, 3D e links privados, sem escrever código.',
  robots: { index: false, follow: false },
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
