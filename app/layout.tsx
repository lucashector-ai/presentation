import type { Metadata, Viewport } from 'next'
// Geist auto-hospedada (@fontsource): o pacote `geist` exige o `next` instalado (e o React 18 dele) e usa next/font.
import '@fontsource-variable/geist'
import '@fontsource-variable/geist-mono'
import './globals.css'
import { ToastProvider } from '@/components/ui/toast'

export const metadata: Metadata = {
  title: { default: 'Mostra — apresentações para quem cria', template: '%s · Mostra' },
  description: 'Crie, apresente e compartilhe experiências visuais que vão além dos slides — com movimento, interações, 3D e links privados, sem escrever código.',
  robots: { index: false, follow: false },
}

export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#FAFAF9' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        {/* favicon: o símbolo da marca em SVG (public/favicon.svg); o PNG da tela inicial do iOS sai de scripts/gerar-favicon.mjs */}
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        {/* tema salvo aplicado antes da pintura (sem flash). Padrão: claro, como no design. */}
        <script dangerouslySetInnerHTML={{ __html: `try{if(localStorage.getItem('tema')==='escuro')document.documentElement.dataset.tema='escuro'}catch(e){}` }} />
      </head>
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  )
}
