'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LogOut, Moon, Plus, Settings, Sun } from 'lucide-react'
import { alternarTema, sair, sessaoAtiva } from '@/lib/sessao'
import { useDemo } from '@/lib/demo/useDemo'
import { Botao, Logo } from '@/components/ui'

/** Casca autenticada: barra superior com marca, novo projeto e menu do usuário. O editor e o modo apresentar usam layout próprio. */
export function Shell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const caminho = usePathname()
  const [pronto, setPronto] = useState(false)
  const [menu, setMenu] = useState(false)
  const usuario = useDemo((e) => e.usuario)
  const semChrome = /\/edit$|\/apresentar$/.test(caminho)

  useEffect(() => {
    if (!sessaoAtiva()) router.replace('/login')
    else setPronto(true)
  }, [router])

  if (!pronto) return <div className="min-h-dvh" />
  if (semChrome) return <>{children}</>

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b bg-superficie/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <Link href="/app" aria-label="Painel"><Logo /></Link>
          <span className="flex-1" />
          <Botao tamanho="sm" icone={<Plus className="h-4 w-4" />} onClick={() => router.push('/app?novo=1')}>Novo projeto</Botao>
          <div className="relative">
            <button aria-label="Menu do usuário" aria-expanded={menu} onClick={() => setMenu((v) => !v)} className="flex h-9 w-9 items-center justify-center rounded-full bg-superficie2 text-sm font-semibold">{usuario.nome.slice(0, 1)}</button>
            {menu && (
              <div role="menu" className="absolute right-0 mt-2 w-56 rounded-xl border bg-superficie p-1 shadow-suave" onMouseLeave={() => setMenu(false)}>
                <div className="px-3 py-2 text-xs text-texto2"><p className="font-medium text-texto">{usuario.nome}</p><p className="truncate">{usuario.email}</p></div>
                <Link role="menuitem" href="/app/settings" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-superficie2"><Settings className="h-4 w-4" /> Conta e planos</Link>
                <button role="menuitem" onClick={() => alternarTema()} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-superficie2"><Sun className="h-4 w-4 dark:hidden" /><Moon className="hidden h-4 w-4 dark:block" /> Alternar tema</button>
                <button role="menuitem" onClick={() => { sair(); router.push('/login') }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-superficie2"><LogOut className="h-4 w-4" /> Sair</button>
              </div>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  )
}
