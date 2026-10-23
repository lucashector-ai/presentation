'use client'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Check, Sparkles } from 'lucide-react'
import { dados, mensagemDeErro, useDados } from '@/lib/dados'
import { PACOTES_AVULSOS, PLANOS, custoApresentacao, precoComCiclo, type PlanoId } from '@/lib/planos'
import { MAX_TELAS_IA, MIN_TELAS_IA, exemploApresentacoes, saldoBaixo, telasCom, textoCreditos, textoTelas } from '@/lib/telasIa'
import { Botao, Modal, cx } from '@/components/ui'
import { CartaoPainel } from './Layout'
import { useToast } from '@/components/ui/toast'

const fmt = (n: number) => n.toLocaleString('pt-BR')

/**
 * Créditos e plano em qualquer tela do app: `abrirCompra()` abre os pacotes avulsos e `abrirPlano(id)`
 * a troca de plano. No modo demonstração nada é cobrado; no modo real ainda não há checkout (a fonte de dados
 * recusa com uma mensagem clara) e saldo, plano e extrato vêm do servidor.
 */
const Ctx = createContext<{ abrirCompra: (motivo?: string) => void; abrirPlano: (id: PlanoId, ciclo?: 'mensal' | 'anual') => void } | null>(null)

export function CreditosProvider({ children }: { children: React.ReactNode }) {
  const [compra, setCompra] = useState<{ motivo?: string } | null>(null)
  const [plano, setPlano] = useState<{ id: PlanoId; ciclo: 'mensal' | 'anual' } | null>(null)
  const abrirCompra = useCallback((motivo?: string) => setCompra({ motivo }), [])
  const abrirPlano = useCallback((id: PlanoId, ciclo: 'mensal' | 'anual' = 'anual') => setPlano({ id, ciclo }), [])
  const valor = useMemo(() => ({ abrirCompra, abrirPlano }), [abrirCompra, abrirPlano])
  return (
    <Ctx.Provider value={valor}>
      {children}
      <AvisoSaldoBaixo abrirCompra={abrirCompra} />
      <ModalComprarCreditos aberto={!!compra} motivo={compra?.motivo} aoFechar={() => setCompra(null)} />
      <ModalTrocarPlano alvo={plano} aoFechar={() => setPlano(null)} />
    </Ctx.Provider>
  )
}

const CHAVE_AVISO = 'mostra.avisoSaldo'
let avisouNestaAba = false
function jaAvisou(): boolean {
  if (avisouNestaAba) return true
  try { return sessionStorage.getItem(CHAVE_AVISO) === '1' } catch { return false }
}
function marcarAviso() {
  avisouNestaAba = true
  try { sessionStorage.setItem(CHAVE_AVISO, '1') } catch { /* sem armazenamento: vale a memória da aba */ }
}

/**
 * Aviso proativo, uma vez por sessão: quando um gasto deixa o saldo em ≈ 1 apresentação (ou menos),
 * um toast com "Comprar" — antes de a pessoa dar de cara com o botão bloqueado.
 */
function AvisoSaldoBaixo({ abrirCompra }: { abrirCompra: (motivo?: string) => void }) {
  const saldo = useDados((e) => e.creditos.saldo)
  const anterior = useRef<number | null>(null)
  const { mostrar } = useToast()
  useEffect(() => {
    const antes = anterior.current
    anterior.current = saldo
    if (antes === null || saldo >= antes || !saldoBaixo(saldo) || jaAvisou()) return
    marcarAviso()
    const n = telasCom(saldo)
    mostrar(
      n > 0 ? `Seu saldo dá para ${textoTelas(saldo)} (${fmt(saldo)} créditos).` : `Seu saldo acabou: ${fmt(saldo)} créditos, nenhuma tela com IA.`,
      'info',
      { rotulo: 'Comprar', aoClicar: () => abrirCompra() }
    )
  }, [saldo, mostrar, abrirCompra])
  return null
}

export function useCreditos() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useCreditos precisa do CreditosProvider')
  return c
}

function ModalComprarCreditos({ aberto, aoFechar, motivo }: { aberto: boolean; aoFechar: () => void; motivo?: string }) {
  const [sel, setSel] = useState(1)
  const saldo = useDados((e) => e.creditos.saldo)
  const { mostrar } = useToast()
  const pacote = PACOTES_AVULSOS[sel] ?? PACOTES_AVULSOS[1]
  const simulada = dados.capacidades.compraSimulada
  const comprar = async () => {
    try {
      await dados.comprarPacote(pacote.creditos)
      mostrar(`${fmt(pacote.creditos)} créditos adicionados · ${textoTelas(pacote.creditos)} a mais (demonstração, sem cobrança).`, 'sucesso')
      aoFechar()
    } catch (e) {
      mostrar(mensagemDeErro(e), 'info')
    }
  }
  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Comprar créditos"
      descricao={motivo ?? `Créditos avulsos não expiram e valem em qualquer plano. Saldo atual: ${fmt(saldo)} (${textoTelas(saldo)}).`}
      rodape={<>
        <Botao variante="secundario" onClick={aoFechar}>Cancelar</Botao>
        <Botao onClick={() => void comprar()}>Comprar {fmt(pacote.creditos)} créditos · R${pacote.precoBRL}</Botao>
      </>}
    >
      <div role="radiogroup" aria-label="Pacotes de créditos" className="grid gap-4 sm:grid-cols-3">
        {PACOTES_AVULSOS.map((p, i) => (
          <button key={p.creditos} type="button" role="radio" aria-checked={sel === i} onClick={() => setSel(i)} className={cx('relative flex flex-col rounded-cartao border-[1.5px] p-4 text-left transition-colors', sel === i ? 'border-tinta bg-lima/60' : 'border-borda hover:border-bordaForte')}>
            {'destaque' in p && <span className="mono absolute right-2 top-2 text-[9px] text-texto2">POPULAR</span>}
            <span className="text-[20px] font-medium tracking-[-0.03em]">{fmt(p.creditos)}</span>
            <span className="text-[12px] text-texto2">créditos</span>
            <span className="mt-2 text-[13px] font-medium">{textoTelas(p.creditos)}</span>
            <span className="text-[11px] text-texto3">{exemploApresentacoes(p.creditos)}</span>
            <span className="mt-4 text-[15px] font-medium">R${p.precoBRL}</span>
          </button>
        ))}
      </div>
      <p className="mt-4 text-[12px] leading-relaxed text-texto2">Uma apresentação pode ter de {MIN_TELAS_IA} a {MAX_TELAS_IA} telas: 10 telas custam {textoCreditos(custoApresentacao(10))}, 20 custam {textoCreditos(custoApresentacao(20))} (roteiro + design de cada tela). {simulada ? 'Modo demonstração: nenhuma cobrança é feita.' : 'O pagamento on-line ainda está chegando: por enquanto, fale com a gente para recarregar.'}</p>
    </Modal>
  )
}

function ModalTrocarPlano({ alvo, aoFechar }: { alvo: { id: PlanoId; ciclo: 'mensal' | 'anual' } | null; aoFechar: () => void }) {
  const atual = useDados((e) => PLANOS[e.workspace.planoId])
  const u = useDados((e) => e.uso)
  const { mostrar } = useToast()
  if (!alvo) return null
  const novo = PLANOS[alvo.id]
  const ordem: PlanoId[] = ['free', 'plus', 'pro', 'studio']
  const upgrade = ordem.indexOf(novo.id) > ordem.indexOf(atual.id)
  const excede = u.projetosAtivos > novo.limites.projetos
  const preco = precoComCiclo(novo, alvo.ciclo)
  const confirmar = async () => {
    try {
      await dados.trocarPlano(novo.id)
      mostrar(`Plano ${novo.nome} ativado${upgrade && novo.creditos.recorrencia === 'mensal' ? ` · +${fmt(novo.creditos.quantidade)} créditos` : ''} (demonstração, sem cobrança).`, 'sucesso')
      aoFechar()
    } catch (e) {
      mostrar(mensagemDeErro(e), 'info')
    }
  }
  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      titulo={`${upgrade ? 'Mudar' : 'Voltar'} para o plano ${novo.nome}?`}
      descricao={preco ? `R$${preco} por ${novo.porMembro ? 'membro por ' : ''}mês${alvo.ciclo === 'anual' ? ', cobrado anualmente' : ''}.` : 'Grátis, para sempre.'}
      rodape={<>
        <Botao variante="secundario" onClick={aoFechar}>Cancelar</Botao>
        <Botao onClick={() => void confirmar()}>{upgrade ? `Assinar ${novo.nome}` : `Mudar para ${novo.nome}`}</Botao>
      </>}
    >
      <ul className="space-y-2 text-[13px]">
        <Linha>{fmt(novo.creditos.quantidade)} créditos {novo.creditos.recorrencia === 'mensal' ? 'por mês' : 'no cadastro'} · {textoTelas(novo.creditos.quantidade)} ({exemploApresentacoes(novo.creditos.quantidade)})</Linha>
        <Linha>{novo.limites.projetos >= Number.MAX_SAFE_INTEGER ? 'Projetos ilimitados' : `${novo.limites.projetos} projetos`} · apresentações de até {novo.limites.telasPorPrompt} telas com IA</Linha>
        <Linha>{novo.capacidades.senhaNoLink ? 'Links com senha e métricas de visualização' : 'Links privados (senha a partir do Pro)'}</Linha>
        {!novo.capacidades.marcaDaPlataforma && <Linha>Sem a marca Mostra nas apresentações</Linha>}
      </ul>
      {!upgrade && excede && <p className="mt-4 rounded-controle bg-aviso/15 px-4 py-2 text-[12px] leading-relaxed text-texto">Você tem {u.projetosAtivos} projetos ativos e o {novo.nome} permite {novo.limites.projetos}. Nada é apagado: os projetos continuam abertos e os links funcionando, mas novos projetos ficam bloqueados.</p>}
      <p className="mt-4 text-[12px] text-texto3">{dados.capacidades.compraSimulada ? 'Modo demonstração: a troca é imediata e nenhuma cobrança é feita.' : 'A assinatura on-line ainda está chegando: por enquanto, a troca de plano é feita pela equipe da Mostra.'}</p>
    </Modal>
  )
}

function Linha({ children }: { children: React.ReactNode }) {
  return <li className="flex items-start gap-2"><Check className="mt-1 h-3.5 w-3.5 shrink-0 text-sucesso" />{children}</li>
}

/** Cartão de créditos do painel: saldo em créditos e em apresentações, plano e próximos passos. */
export function CartaoCreditos({ className }: { className?: string }) {
  const saldo = useDados((e) => e.creditos.saldo)
  const ws = useDados((e) => e.workspace)
  const plano = PLANOS[ws.planoId]
  const { abrirCompra } = useCreditos()
  const n = telasCom(saldo)
  const pct = Math.min(100, Math.round((saldo / Math.max(plano.creditos.quantidade, 1)) * 100))
  const pouco = saldoBaixo(saldo)
  return (
    <CartaoPainel
      className={className}
      // sem créditos: o cartão avisa (tom perigo) e comprar vira a ação principal
      tom={n > 0 ? 'normal' : 'perigo'}
      titulo="Créditos de IA"
      idTitulo="titulo-creditos"
      acao={<Link href="/app/settings#plano" className="shrink-0 text-[12px] text-texto2 hover:text-texto">Plano {plano.nome}</Link>}
      rodape={<>
        <Botao variante={pouco ? 'primario' : 'secundario'} className="min-w-0 flex-1 whitespace-nowrap" onClick={() => abrirCompra()}>Comprar créditos</Botao>
        <Link href="/app/settings#plano" className="inline-flex h-10 shrink-0 items-center justify-center rounded-controle border-[1.5px] border-transparent px-4 text-sm font-medium text-texto hover:bg-hover">{ws.planoId === 'studio' ? 'Ver uso' : 'Ver planos'}</Link>
      </>}
    >
      <div className="flex items-baseline gap-2">
        <Sparkles className="h-4 w-4 self-center text-acento" />
        <span className="text-[28px] font-medium leading-none tracking-[-0.04em]">{fmt(saldo)}</span>
        <span className="text-[13px] text-texto2">créditos</span>
      </div>
      <p className={cx('mt-2 text-[13px]', pouco ? 'text-perigo' : 'text-texto2')}>{n > 0 ? `${textoTelas(saldo)} · ${exemploApresentacoes(saldo)}` : 'Sem créditos para telas com IA'}</p>
      <div className="mt-4 h-1 overflow-hidden rounded-sm bg-borda" aria-hidden><div className={cx('h-full', pouco ? 'bg-perigo' : 'bg-acento')} style={{ width: `${Math.max(2, pct)}%` }} /></div>
      <p className="mt-2 text-[11px] text-texto3">{plano.creditos.recorrencia === 'mensal' ? `Renova ${fmt(plano.creditos.quantidade)} por mês` : `${fmt(plano.creditos.quantidade)} créditos de boas-vindas`} · editar, apresentar e enviar não gastam créditos</p>
    </CartaoPainel>
  )
}
