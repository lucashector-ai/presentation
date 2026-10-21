'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Home, Library, LogOut, Menu, Moon, Search, Send, Settings2, Sparkles, Trash2, X } from 'lucide-react'
import { alternarTema, MODO_DEMO, sair, sessaoAtiva, verificarSessao } from '@/lib/sessao'
import { useDemo } from '@/lib/demo/useDemo'
import { PLANOS, formatarBytes, percentualUso, textoApresentacoes } from '@/lib/planos'
import { estadoDoLink } from '@/lib/share/token'
import { Marca, cx } from '@/components/ui'
import { CreditosProvider, useCreditos } from './Creditos'
import { BuscaRapida } from './BuscaRapida'

/** Rotas de tela cheia (sem barra lateral): editor, apresentação e o assistente de novo projeto. */
const SEM_CHROME = /\/edit$|\/apresentar$|\/apresentador$|\/app\/novo$/

export function Shell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const caminho = usePathname()
  const [pronto, setPronto] = useState(false)

  useEffect(() => {
    // guarda o destino (ex.: um projeto ou /app/criar?prompt=…) para voltar depois de entrar
    const negar = () => router.replace(`/login?${new URLSearchParams({ proximo: `${window.location.pathname}${window.location.search}` })}`)
    if (MODO_DEMO) {
      if (sessaoAtiva()) return setPronto(true)
      return negar()
    }
    // modo real: sessão do Neon Auth (também conclui o retorno do login com Google, que chega com ?neon_auth_session_verifier)
    let vivo = true
    verificarSessao().then((ok) => { if (vivo) (ok ? setPronto(true) : negar()) })
    return () => { vivo = false }
  }, [router])

  if (!pronto) return <div className={cx('min-h-dvh', /\/apresentar$|\/apresentador$/.test(caminho) ? 'bg-[#111]' : 'bg-fundo')} />
  return <CreditosProvider>{SEM_CHROME.test(caminho) ? children : <Moldura caminho={caminho}>{children}</Moldura>}</CreditosProvider>
}

function Moldura({ caminho, children }: { caminho: string; children: React.ReactNode }) {
  const router = useRouter()
  const [menuMovel, setMenuMovel] = useState(false)
  const [menuUsuario, setMenuUsuario] = useState(false)
  const [busca, setBusca] = useState(false)
  const { abrirCompra } = useCreditos()
  const usuario = useDemo((e) => e.usuario)
  const ws = useDemo((e) => e.workspace)
  const saldo = useDemo((e) => e.creditos.saldo)
  const contagem = useDemo((e) => {
    const vivos = e.projetos.filter((p) => !p.excluidoEm)
    const comLink = new Set(e.links.filter((l) => estadoDoLink({ expiresAt: l.expiraEm, revokedAt: l.revogadoEm }) === 'ativo').map((l) => l.projectId))
    return { enviados: vivos.filter((p) => comLink.has(p.id)).length, lixeira: e.projetos.length - vivos.length, armazenamento: e.assets.reduce((s, a) => s + a.bytes, 0) }
  })
  const fecharBusca = useCallback(() => setBusca(false), [])

  useEffect(() => { setMenuMovel(false); setMenuUsuario(false) }, [caminho])
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setBusca((v) => !v) } }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [])

  const plano = PLANOS[ws.planoId]
  const nav = [
    { href: '/app', rotulo: 'Início', icone: Home, ativo: caminho === '/app' || caminho.startsWith('/app/projects') },
    { href: '/app/criar', rotulo: 'Criar com IA', icone: Sparkles, ativo: caminho === '/app/criar', ponto: true },
    { href: '/app/compartilhados', rotulo: 'Enviados', icone: Send, contagem: contagem.enviados || undefined, ativo: caminho === '/app/compartilhados' },
    { href: '/app/biblioteca', rotulo: 'Biblioteca', icone: Library, ativo: caminho === '/app/biblioteca' },
    { href: '/app/lixeira', rotulo: 'Lixeira', icone: Trash2, contagem: contagem.lixeira || undefined, ativo: caminho === '/app/lixeira' },
    { href: '/app/settings', rotulo: 'Plano e conta', icone: Settings2, ativo: caminho === '/app/settings' },
  ]
  const iniciais = usuario.nome.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()

  const lateral = (
    <aside className="flex h-full flex-col gap-5 px-3 py-[18px]">
      <Link href="/app" className="px-2 text-[20px] text-texto" aria-label="Mostra — início"><Marca /></Link>
      <Link href="/app/settings#plano" className="flex items-center gap-2.5 rounded-[9px] border border-borda bg-superficie p-2 text-left hover:border-[#D4D4D4]">
        <span className="flex h-7 w-7 items-center justify-center rounded-[7px] bg-carvao text-[12px] font-semibold text-argila">{ws.nome[0]}</span>
        <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-medium">{ws.nome}</span><span className="block text-[11px] text-texto3">Plano {plano.nome} · {ws.membros} {ws.membros === 1 ? 'membro' : 'membros'}</span></span>
      </Link>
      <button type="button" onClick={() => { setMenuMovel(false); setBusca(true) }} className="flex h-9 items-center gap-2 rounded-[9px] border border-borda bg-superficie px-2.5 text-[13px] text-texto3 hover:border-[#D4D4D4] hover:text-texto2">
        <Search className="h-[15px] w-[15px]" strokeWidth={1.75} />Buscar
        <kbd className="mono ml-auto rounded border border-borda px-1.5 text-[10px]">⌘K</kbd>
      </button>
      <nav aria-label="Navegação principal" className="flex flex-col gap-0.5 text-[14px]">
        {nav.map((n) => (
          <Link key={n.rotulo} href={n.href} aria-current={n.ativo ? 'page' : undefined} className={cx('flex items-center gap-2.5 rounded-[7px] px-2.5 py-2 transition-colors hover:bg-hover hover:text-texto', n.ativo ? 'bg-hover font-medium text-texto' : 'text-[#525252]')}>
            <n.icone className="h-4 w-4 opacity-85" strokeWidth={1.75} />
            {n.rotulo}
            {n.ponto && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-acento" />}
            {n.contagem !== undefined && <span className="ml-auto text-[12px] text-texto3">{n.contagem}</span>}
          </Link>
        ))}
      </nav>
      <div className="mt-auto flex flex-col gap-3.5">
        <div className="rounded-[9px] border border-borda bg-superficie p-3">
          <div className="flex items-center justify-between gap-2 text-[12px]">
            <span className="flex items-center gap-1.5 font-medium"><Sparkles className="h-3.5 w-3.5 text-acento" />{saldo.toLocaleString('pt-BR')} créditos</span>
            <button type="button" onClick={() => abrirCompra()} className="text-[12px] font-medium text-acento hover:underline">Comprar</button>
          </div>
          <div className="mt-1 text-[11px] text-texto3">{textoApresentacoes(saldo)} de 10 telas</div>
        </div>
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
              <div className="truncate px-3 py-2 text-[12px] text-texto2">{usuario.email}</div>
              <button role="menuitem" onClick={() => router.push('/app/settings')} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-[13px] hover:bg-hover"><Settings2 className="h-4 w-4" /> Plano e conta</button>
              <button role="menuitem" onClick={() => alternarTema()} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-[13px] hover:bg-hover"><Moon className="h-4 w-4" /> Alternar tema</button>
              <button role="menuitem" onClick={async () => { await sair(); router.push('/login') }} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-[13px] hover:bg-hover"><LogOut className="h-4 w-4" /> Sair</button>
            </div>
          )}
        </div>
      </div>
    </aside>
  )

  return (
    <div className="min-h-dvh bg-fundo lg:grid lg:grid-cols-[232px_minmax(0,1fr)]">
      <div className="sticky top-0 hidden h-dvh overflow-y-auto border-r border-borda lg:block">{lateral}</div>
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-borda bg-fundo/95 px-4 backdrop-blur lg:hidden">
        <Link href="/app" className="text-[20px]" aria-label="Mostra — início"><Marca /></Link>
        <div className="flex items-center gap-1">
          <button type="button" aria-label="Buscar" onClick={() => setBusca(true)} className="rounded-md p-2 hover:bg-hover"><Search className="h-5 w-5" /></button>
          <button type="button" aria-label="Abrir menu" aria-expanded={menuMovel} onClick={() => setMenuMovel(true)} className="rounded-md p-2 hover:bg-hover"><Menu className="h-5 w-5" /></button>
        </div>
      </header>
      {menuMovel && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMenuMovel(false)} />
          <div className="absolute inset-y-0 left-0 w-[268px] overflow-y-auto bg-fundo shadow-painel">
            <button type="button" aria-label="Fechar menu" onClick={() => setMenuMovel(false)} className="absolute right-3 top-4 rounded-md p-1.5 hover:bg-hover"><X className="h-4 w-4" /></button>
            {lateral}
          </div>
        </div>
      )}
      <main className="min-w-0 px-4 pb-20 pt-7 sm:px-[clamp(24px,4vw,56px)] sm:pt-10">{children}</main>
      <BuscaRapida aberta={busca} aoFechar={fecharBusca} />
    </div>
  )
}
