import type { Metadata, Viewport } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
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
    <html lang="pt-BR" suppressHydrationWarning className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <head>
        {/* tema salvo aplicado antes da pintura (sem flash). Padrão: claro, como no design. */}
        <script dangerouslySetInnerHTML={{ __html: `try{if(localStorage.getItem('tema')==='escuro')document.documentElement.dataset.tema='escuro'}catch(e){}` }} />
      </head>
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  )
}
