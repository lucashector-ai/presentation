'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Folder, Home, Library, LogOut, Menu, Moon, Settings2, Trash2, Users, X } from 'lucide-react'
import { alternarTema, sair, sessaoAtiva } from '@/lib/sessao'
import { useDemo } from '@/lib/demo/useDemo'
import { PLANOS, formatarBytes, percentualUso } from '@/lib/planos'
import { estadoDoLink } from '@/lib/share/token'
import { Marca, cx } from '@/components/ui'

/** Rotas de tela cheia (sem barra lateral). */
const SEM_CHROME = /\/edit$|\/apresentar$|\/apresentador$|\/app\/novo$/

export function Shell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const caminho = usePathname()
  const [pronto, setPronto] = useState(false)
  const [menuMovel, setMenuMovel] = useState(false)
  const [menuUsuario, setMenuUsuario] = useState(false)
  const usuario = useDemo((e) => e.usuario)
  const ws = useDemo((e) => e.workspace)
  const contagem = useDemo((e) => {
    const vivos = e.projetos.filter((p) => !p.excluidoEm)
    const comLink = new Set(e.links.filter((l) => estadoDoLink({ expiresAt: l.expiraEm, revokedAt: l.revogadoEm }) === 'ativo').map((l) => l.projectId))
    return { meus: vivos.filter((p) => p.status !== 'archived').length, compartilhados: vivos.filter((p) => comLink.has(p.id)).length, lixeira: e.projetos.length - vivos.length, armazenamento: e.assets.reduce((s, a) => s + a.bytes, 0) }
  })

  useEffect(() => {
    if (!sessaoAtiva()) router.replace('/login')
    else setPronto(true)
  }, [router])
  useEffect(() => setMenuMovel(false), [caminho])

  if (!pronto) return <div className="min-h-dvh bg-fundo" />
  if (SEM_CHROME.test(caminho)) return <>{children}</>

  const plano = PLANOS[ws.planoId]
  const nav = [
    { href: '/app', rotulo: 'Início', icone: Home, ativo: caminho === '/app' },
    { href: '/app?filtro=meus', rotulo: 'Meus projetos', icone: Folder, contagem: contagem.meus, ativo: false },
    { href: '/app/compartilhados', rotulo: 'Compartilhados', icone: Users, contagem: contagem.compartilhados, ativo: caminho === '/app/compartilhados' },
    { href: '/app/biblioteca', rotulo: 'Biblioteca', icone: Library, ativo: caminho === '/app/biblioteca' },
    { href: '/app/lixeira', rotulo: 'Lixeira', icone: Trash2, contagem: contagem.lixeira || undefined, ativo: caminho === '/app/lixeira' },
    { href: '/app/settings', rotulo: 'Configurações', icone: Settings2, ativo: caminho === '/app/settings' },
  ]
  const iniciais = usuario.nome.split(' ').map((p) => p[0]).slice(0, 2).join('')

  const lateral = (
    <aside className="flex h-full flex-col gap-6 px-3 py-[18px]">
      <Link href="/app" className="px-2 text-[20px] text-texto" aria-label="Mostra — início"><Marca /></Link>
      <button type="button" className="flex items-center gap-2.5 rounded-[9px] border border-borda bg-superficie p-2 text-left hover:border-[#D4D4D4]" title="Trocar de espaço (Fase 2)">
        <span className="flex h-7 w-7 items-center justify-center rounded-[7px] bg-carvao text-[12px] font-semibold text-argila">{ws.nome[0]}</span>
        <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-medium">{ws.nome}</span><span className="block text-[11px] text-texto3">Plano {plano.nome} · {ws.membros} membros</span></span>
        <span className="text-[10px] text-texto3">▾</span>
      </button>
      <nav aria-label="Navegação principal" className="flex flex-col gap-0.5 text-[14px]">
        {nav.map((n) => (
          <Link key={n.rotulo} href={n.href} aria-current={n.ativo ? 'page' : undefined} className={cx('flex items-center gap-2.5 rounded-[7px] px-2.5 py-2 transition-colors hover:bg-hover hover:text-texto', n.ativo ? 'bg-hover font-medium text-texto' : 'text-[#525252]')}>
            <n.icone className="h-4 w-4 opacity-85" strokeWidth={1.75} />
            {n.rotulo}
            {n.contagem !== undefined && <span className="ml-auto text-[12px] text-texto3">{n.contagem}</span>}
          </Link>
        ))}
      </nav>
      <div className="mt-auto flex flex-col gap-3.5">
        <div className="flex flex-col gap-2 px-2.5">
          <div className="flex justify-between text-[12px] text-texto2"><span>Armazenamento</span><span>{formatarBytes(contagem.armazenamento)} / {formatarBytes(plano.limites.armazenamentoBytes)}</span></div>
          <div className="h-[3px] rounded-sm bg-borda"><div className="h-[3px] rounded-sm bg-grafite" style={{ width: `${Math.max(2, percentualUso(contagem.armazenamento, plano.limites.armazenamentoBytes))}%` }} /></div>
        </div>
        <div className="relative border-t border-borda pt-3.5">
          <button type="button" aria-label="Menu do usuário" aria-expanded={menuUsuario} onClick={() => setMenuUsuario((v) => !v)} className="flex w-full items-center gap-2.5 rounded-[7px] px-2.5 py-1.5 text-left hover:bg-hover">
            <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-salvia text-[11px] font-semibold text-musgo">{iniciais}</span>
            <span className="truncate text-[13px]">{usuario.nome}</span>
          </button>
          {menuUsuario && (
            <div role="menu" className="absolute bottom-12 left-0 right-0 rounded-lg border border-borda bg-superficie p-1 shadow-painel" onMouseLeave={() => setMenuUsuario(false)}>
              <div className="px-3 py-2 text-[12px] text-texto2">{usuario.email}</div>
              <button role="menuitem" onClick={() => alternarTema()} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-[13px] hover:bg-hover"><Moon className="h-4 w-4" /> Alternar tema</button>
              <button role="menuitem" onClick={() => { sair(); router.push('/login') }} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-[13px] hover:bg-hover"><LogOut className="h-4 w-4" /> Sair</button>
            </div>
          )}
        </div>
      </div>
    </aside>
  )

  return (
    <div className="min-h-dvh bg-fundo lg:grid lg:grid-cols-[232px_minmax(0,1fr)]">
      <div className="sticky top-0 hidden h-dvh border-r border-borda lg:block">{lateral}</div>
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-borda bg-fundo/95 px-4 backdrop-blur lg:hidden">
        <Link href="/app" className="text-[20px]" aria-label="Mostra — início"><Marca /></Link>
        <button type="button" aria-label="Abrir menu" aria-expanded={menuMovel} onClick={() => setMenuMovel(true)} className="rounded-md p-2 hover:bg-hover"><Menu className="h-5 w-5" /></button>
      </header>
      {menuMovel && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMenuMovel(false)} />
          <div className="absolute inset-y-0 left-0 w-[260px] bg-fundo shadow-painel">
            <button type="button" aria-label="Fechar menu" onClick={() => setMenuMovel(false)} className="absolute right-3 top-4 rounded-md p-1.5 hover:bg-hover"><X className="h-4 w-4" /></button>
            {lateral}
          </div>
        </div>
      )}
      <main className="min-w-0 px-5 pb-20 pt-8 sm:px-[clamp(24px,4vw,56px)] sm:pt-10">{children}</main>
    </div>
  )
}
