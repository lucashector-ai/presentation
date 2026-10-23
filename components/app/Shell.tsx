'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ArrowLeftRight, Home, Library, LogOut, Menu, Search, Send, Settings2, Sparkles, Trash2, X } from 'lucide-react'
import { MODO_DEMO, sessaoAtiva, verificarSessao } from '@/lib/sessao'
import { dados, mensagemDeErro, useCarregar, useDados, type EspacoDeTrabalho } from '@/lib/dados'
import { PLANOS, formatarBytes, percentualUso } from '@/lib/planos'
import { exemploApresentacoes, textoTelas } from '@/lib/telasIa'
import { estadoDoLink } from '@/lib/share/token'
import { Atrasado, Carregando, Marca, cx } from '@/components/ui'
import { TAMANHO_MARCA } from '@/components/ui/Logo'
import { CreditosProvider, useCreditos } from './Creditos'
import { BuscaRapida } from './BuscaRapida'
import { ProgressoNavegacao } from './ProgressoNavegacao'
import { SeletorTema } from './SeletorTema'

/** Rotas de tela cheia (sem barra lateral): editor, apresentação e o assistente de novo projeto. */
const SEM_CHROME = /\/edit$|\/apresentar$|\/apresentador$|\/app\/novo$/

export function Shell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const caminho = usePathname()
  const [pronto, setPronto] = useState(false)
  const [falha, setFalha] = useState<string | null>(null)
  const [tentativa, setTentativa] = useState(0)

  useEffect(() => {
    // guarda o destino (ex.: um projeto ou /app/criar?prompt=…) para voltar depois de entrar
    const negar = () => router.replace(`/login?${new URLSearchParams({ proximo: `${window.location.pathname}${window.location.search}` })}`)
    if (MODO_DEMO) {
      if (sessaoAtiva()) return setPronto(true)
      return negar()
    }
    // modo real: sessão do Neon Auth (também conclui o retorno do login com Google, que chega com ?neon_auth_session_verifier);
    // depois carrega a conta (nome, plano, créditos) antes de mostrar o app
    let vivo = true
    setFalha(null)
    verificarSessao()
      .then(async (ok) => {
        if (!vivo) return
        if (!ok) return negar()
        await dados.iniciarSessao()
        if (vivo) setPronto(true)
      })
      .catch((e) => { if (vivo) setFalha(mensagemDeErro(e, 'Não foi possível abrir sua conta agora.')) })
    return () => { vivo = false }
  }, [router, tentativa])

  if (falha) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-fundo p-6 text-center" role="alert">
        <Marca />
        <p className="max-w-sm text-[15px] text-texto2">{falha}</p>
        <button type="button" onClick={() => setTentativa((n) => n + 1)} className="h-10 rounded-controle bg-acao px-4 text-[14px] font-medium text-acaoTexto">Tentar de novo</button>
      </div>
    )
  }
  if (!pronto) {
    const escuro = /\/apresentar$|\/apresentador$/.test(caminho)
    return <div className={cx('flex min-h-dvh items-center justify-center', escuro ? 'bg-[#111] text-white/60' : 'bg-fundo')} aria-busy="true">{!MODO_DEMO && <Atrasado ms={600}><Carregando texto="Abrindo sua conta…" /></Atrasado>}</div>
  }
  return <CreditosProvider><ProgressoNavegacao />{SEM_CHROME.test(caminho) ? children : <Moldura caminho={caminho}>{children}</Moldura>}</CreditosProvider>
}

function Moldura({ caminho, children }: { caminho: string; children: React.ReactNode }) {
  const router = useRouter()
  const [menuMovel, setMenuMovel] = useState(false)
  const [menuUsuario, setMenuUsuario] = useState(false)
  const [busca, setBusca] = useState(false)
  const { abrirCompra } = useCreditos()
  const usuario = useDados((e) => e.usuario)
  const ws = useDados((e) => e.workspace)
  const saldo = useDados((e) => e.creditos.saldo)
  // contagens da barra lateral (no modo real chegam em segundo plano; o cache serve às outras telas)
  useCarregar(['projetos', 'links', 'lixeira'])
  const contagem = useDados((e) => {
    const vivos = e.projetos.filter((p) => !p.excluidoEm)
    const comLink = new Set(e.links.filter((l) => estadoDoLink({ expiresAt: l.expiraEm, revokedAt: l.revogadoEm }) === 'ativo').map((l) => l.projectId))
    return { enviados: vivos.filter((p) => comLink.has(p.id)).length, lixeira: e.projetos.length - vivos.length, armazenamento: e.uso.armazenamentoBytes }
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
  const nomeExibido = usuario.nome.trim() || usuario.email.split('@')[0] || 'Você'
  const iniciais = nomeExibido.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase()

  const lateral = (
    // barra de 232: padding 16 e filhos com px-2, então logo, ícones e textos começam todos a 24 px da borda
    <aside className="flex h-full flex-col gap-6 px-4 py-6">
      <Link href="/app" className={cx('flex h-10 items-center px-2 text-texto', TAMANHO_MARCA)} aria-label="Mostra — início"><Marca /></Link>
      <Link href="/app/settings#plano" className="flex items-center gap-2 rounded-controle border border-borda bg-superficie p-2 text-left hover:border-bordaHover">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-controle bg-carvao text-[12px] font-semibold text-argila">{ws.nome[0] ?? 'M'}</span>
        <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-medium">{ws.nome}</span><span className="block text-[11px] text-texto3">Plano {plano.nome} · {ws.membros} {ws.membros === 1 ? 'membro' : 'membros'}{ws.papel === 'viewer' ? ' · só ver' : ''}</span></span>
      </Link>
      <SeletorEspaco />
      <button type="button" onClick={() => { setMenuMovel(false); setBusca(true) }} className="flex h-10 items-center gap-2 rounded-controle border border-borda bg-superficie px-2 text-[13px] text-texto3 hover:border-bordaHover hover:text-texto2">
        <Search className="h-4 w-4" strokeWidth={1.75} />Buscar
        <kbd className="mono ml-auto rounded border border-borda px-1 text-[10px]">⌘K</kbd>
      </button>
      <nav aria-label="Navegação principal" className="flex flex-col gap-1 text-[14px]">
        {nav.map((n) => (
          <Link key={n.rotulo} href={n.href} aria-current={n.ativo ? 'page' : undefined} className={cx('flex h-10 items-center gap-2 rounded-controle px-2 transition-colors hover:bg-hover hover:text-texto', n.ativo ? 'bg-hover font-medium text-texto' : 'text-textoCorpo')}>
            <n.icone className="h-4 w-4 opacity-85" strokeWidth={1.75} />
            {n.rotulo}
            {n.ponto && <span aria-hidden className="h-2 w-2 rounded-full bg-acento" />}
            {n.contagem !== undefined && <span className="ml-auto text-[12px] text-texto3">{n.contagem}</span>}
          </Link>
        ))}
      </nav>
      <div className="mt-auto flex flex-col gap-4">
        <div className="rounded-controle border border-borda bg-superficie p-2">
          <div className="flex items-center justify-between gap-2 text-[12px]">
            <span className="flex items-center gap-2 font-medium"><Sparkles className="h-4 w-4 text-acento" />{saldo.toLocaleString('pt-BR')} créditos</span>
            <button type="button" onClick={() => abrirCompra()} className="text-[12px] font-medium text-acento hover:underline">Comprar</button>
          </div>
          <div className="mt-1 text-[11px] text-texto3" title={exemploApresentacoes(saldo)}>{textoTelas(saldo)}</div>
        </div>
        <div className="flex flex-col gap-2 px-2">
          <div className="flex justify-between text-[12px] text-texto2"><span>Armazenamento</span><span>{formatarBytes(contagem.armazenamento)} / {formatarBytes(plano.limites.armazenamentoBytes)}</span></div>
          <div className="h-[3px] rounded-sm bg-borda"><div className="h-[3px] rounded-sm bg-acao" style={{ width: `${Math.max(2, percentualUso(contagem.armazenamento, plano.limites.armazenamentoBytes))}%` }} /></div>
        </div>
        <div className="relative border-t border-borda pt-4">
          <button type="button" aria-label="Menu do usuário" aria-expanded={menuUsuario} onClick={() => setMenuUsuario((v) => !v)} className="flex h-10 w-full items-center gap-2 rounded-controle px-2 text-left hover:bg-hover">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-salvia text-[11px] font-semibold text-musgo">{iniciais}</span>
            <span className="truncate text-[13px]">{nomeExibido}</span>
          </button>
          {menuUsuario && (
            <div role="menu" className="absolute bottom-12 left-0 right-0 rounded-controle border border-borda bg-superficie p-1 shadow-painel" onMouseLeave={() => setMenuUsuario(false)}>
              <div className="truncate px-2 py-2 text-[12px] text-texto2">{usuario.email}</div>
              <button role="menuitem" onClick={() => router.push('/app/settings')} className="flex h-8 w-full items-center gap-2 rounded-controle px-2 text-[13px] hover:bg-hover"><Settings2 className="h-4 w-4" /> Plano e conta</button>
              {/* tema (auto / claro / escuro): a mesma escolha de Plano e conta → Preferências */}
              <div className="flex h-10 items-center justify-between gap-2 px-2 text-[13px]"><span>Tema</span><SeletorTema compacto /></div>
              <button role="menuitem" onClick={async () => { await dados.sair(); router.push('/login') }} className="flex h-8 w-full items-center gap-2 rounded-controle px-2 text-[13px] hover:bg-hover"><LogOut className="h-4 w-4" /> Sair</button>
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
        <Link href="/app" className={TAMANHO_MARCA} aria-label="Mostra — início"><Marca /></Link>
        <div className="flex items-center gap-1">
          <button type="button" aria-label="Buscar" onClick={() => setBusca(true)} className="rounded-md p-2 hover:bg-hover"><Search className="h-5 w-5" /></button>
          <button type="button" aria-label="Abrir menu" aria-expanded={menuMovel} onClick={() => setMenuMovel(true)} className="rounded-md p-2 hover:bg-hover"><Menu className="h-5 w-5" /></button>
        </div>
      </header>
      {menuMovel && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMenuMovel(false)} />
          <div className="absolute inset-y-0 left-0 w-[272px] overflow-y-auto bg-fundo shadow-painel">
            <button type="button" aria-label="Fechar menu" onClick={() => setMenuMovel(false)} className="absolute right-4 top-6 flex h-10 w-10 items-center justify-center rounded-controle hover:bg-hover"><X className="h-4 w-4" /></button>
            {lateral}
          </div>
        </div>
      )}
      {/* margens do grid do painel (T.layout.margem): 16 → 32 → 48; o conteúdo usa PaginaPainel (components/app/Layout.tsx).
          Em telas largas o main para em 1248 + margens e fica encostado na barra lateral (não centralizado no que sobra) */}
      <main className="min-w-0 px-4 pb-20 pt-6 sm:px-8 sm:pt-8 lg:max-w-painel-lg lg:pt-10 xl:max-w-painel-xl xl:px-12">{children}</main>
      <BuscaRapida aberta={busca} aoFechar={fecharBusca} />
    </div>
  )
}

/** Trocar de espaço (o próprio e os aceitos por convite). Só aparece quando há mais de um. */
function SeletorEspaco() {
  const [espacos, setEspacos] = useState<EspacoDeTrabalho[]>([])
  const [aberto, setAberto] = useState(false)
  useEffect(() => {
    let vivo = true
    dados.espacos.listar().then((l) => { if (vivo) setEspacos(l) }, () => {})
    return () => { vivo = false }
  }, [])
  if (espacos.length < 2) return null
  return (
    <div className="relative -mt-4">
      <button type="button" aria-expanded={aberto} onClick={() => setAberto((v) => !v)} className="flex h-8 w-full items-center gap-2 rounded-controle px-2 text-left text-[12px] text-texto2 hover:bg-hover hover:text-texto"><ArrowLeftRight className="h-4 w-4" /> Trocar de espaço</button>
      {aberto && (
        <div role="menu" aria-label="Espaços" className="absolute left-0 right-0 z-40 mt-1 rounded-lg border border-borda bg-superficie p-1 shadow-painel" onMouseLeave={() => setAberto(false)}>
          {espacos.map((e) => (
            <button key={e.id} role="menuitemradio" aria-checked={e.ativo} disabled={e.ativo} onClick={async () => { await dados.espacos.ativar(e.id); window.location.assign('/app') }} className={cx('flex w-full flex-col rounded-controle px-2 py-2 text-left text-[13px] hover:bg-hover', e.ativo && 'bg-hover font-medium')}>
              <span className="truncate">{e.nome}</span>
              <span className="text-[11px] font-normal text-texto3">{e.proprio ? 'seu espaço' : e.papel === 'viewer' ? 'você pode ver' : 'você pode editar'}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
