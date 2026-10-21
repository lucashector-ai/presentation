'use client'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Check, Sparkles } from 'lucide-react'
import { comprarPacote, trocarPlano, uso } from '@/lib/demo/store'
import { useDemo } from '@/lib/demo/useDemo'
import { PACOTES_AVULSOS, PLANOS, TELAS_REFERENCIA, apresentacoesCom, custoApresentacao, precoComCiclo, textoApresentacoes, type PlanoId } from '@/lib/planos'
import { Botao, Modal, cx } from '@/components/ui'
import { useToast } from '@/components/ui/toast'

const fmt = (n: number) => n.toLocaleString('pt-BR')

/**
 * Créditos e plano em qualquer tela do app: `abrirCompra()` abre os pacotes avulsos e `abrirPlano(id)`
 * a troca de plano. No modo demonstração nada é cobrado; no produto real os dois viram checkout.
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
  const saldo = useDemo((e) => e.creditos.saldo)
  const anterior = useRef<number | null>(null)
  const { mostrar } = useToast()
  useEffect(() => {
    const antes = anterior.current
    anterior.current = saldo
    if (antes === null || saldo >= antes || apresentacoesCom(saldo) > 1 || jaAvisou()) return
    marcarAviso()
    const n = apresentacoesCom(saldo)
    mostrar(
      n === 1 ? `Seu saldo dá ≈ 1 apresentação de ${TELAS_REFERENCIA} telas (${fmt(saldo)} créditos).` : `Seu saldo não dá para uma apresentação de ${TELAS_REFERENCIA} telas (${fmt(saldo)} créditos).`,
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
  const saldo = useDemo((e) => e.creditos.saldo)
  const { mostrar } = useToast()
  const pacote = PACOTES_AVULSOS[sel] ?? PACOTES_AVULSOS[1]
  const comprar = () => {
    comprarPacote(pacote.creditos)
    mostrar(`${fmt(pacote.creditos)} créditos adicionados · ${textoApresentacoes(pacote.creditos)} a mais (demonstração, sem cobrança).`, 'sucesso')
    aoFechar()
  }
  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Comprar créditos"
      descricao={motivo ?? `Créditos avulsos não expiram e valem em qualquer plano. Saldo atual: ${fmt(saldo)} (${textoApresentacoes(saldo)}).`}
      rodape={<>
        <Botao variante="secundario" onClick={aoFechar}>Cancelar</Botao>
        <Botao onClick={comprar}>Comprar {fmt(pacote.creditos)} créditos · R${pacote.precoBRL}</Botao>
      </>}
    >
      <div role="radiogroup" aria-label="Pacotes de créditos" className="grid gap-2.5 sm:grid-cols-3">
        {PACOTES_AVULSOS.map((p, i) => (
          <button key={p.creditos} type="button" role="radio" aria-checked={sel === i} onClick={() => setSel(i)} className={cx('relative flex flex-col rounded-xl border-[1.5px] p-3.5 text-left transition-colors', sel === i ? 'border-grafite bg-lima/60' : 'border-borda hover:border-bordaForte')}>
            {'destaque' in p && <span className="mono absolute right-2.5 top-2.5 text-[9px] text-texto2">POPULAR</span>}
            <span className="text-[20px] font-medium tracking-[-0.03em]">{fmt(p.creditos)}</span>
            <span className="text-[12px] text-texto2">créditos</span>
            <span className="mt-2 text-[13px] font-medium">≈ {fmt(apresentacoesCom(p.creditos))} apresentações</span>
            <span className="mt-3 text-[15px] font-medium">R${p.precoBRL}</span>
          </button>
        ))}
      </div>
      <p className="mt-4 text-[12px] leading-relaxed text-texto2">Conta feita com apresentações de {TELAS_REFERENCIA} telas ({custoApresentacao(TELAS_REFERENCIA)} créditos cada: roteiro + design de cada tela). Modo demonstração: nenhuma cobrança é feita.</p>
    </Modal>
  )
}

function ModalTrocarPlano({ alvo, aoFechar }: { alvo: { id: PlanoId; ciclo: 'mensal' | 'anual' } | null; aoFechar: () => void }) {
  const atual = useDemo((e) => PLANOS[e.workspace.planoId])
  const u = useDemo((e) => uso(e))
  const { mostrar } = useToast()
  if (!alvo) return null
  const novo = PLANOS[alvo.id]
  const ordem: PlanoId[] = ['free', 'plus', 'pro', 'studio']
  const upgrade = ordem.indexOf(novo.id) > ordem.indexOf(atual.id)
  const excede = u.projetosAtivos > novo.limites.projetos
  const preco = precoComCiclo(novo, alvo.ciclo)
  const confirmar = () => {
    trocarPlano(novo.id)
    mostrar(`Plano ${novo.nome} ativado${upgrade && novo.creditos.recorrencia === 'mensal' ? ` · +${fmt(novo.creditos.quantidade)} créditos` : ''} (demonstração, sem cobrança).`, 'sucesso')
    aoFechar()
  }
  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      titulo={`${upgrade ? 'Mudar' : 'Voltar'} para o plano ${novo.nome}?`}
      descricao={preco ? `R$${preco} por ${novo.porMembro ? 'membro por ' : ''}mês${alvo.ciclo === 'anual' ? ', cobrado anualmente' : ''}.` : 'Grátis, para sempre.'}
      rodape={<>
        <Botao variante="secundario" onClick={aoFechar}>Cancelar</Botao>
        <Botao onClick={confirmar}>{upgrade ? `Assinar ${novo.nome}` : `Mudar para ${novo.nome}`}</Botao>
      </>}
    >
      <ul className="space-y-2 text-[13px]">
        <Linha>{fmt(novo.creditos.quantidade)} créditos {novo.creditos.recorrencia === 'mensal' ? 'por mês' : 'no cadastro'} · {textoApresentacoes(novo.creditos.quantidade)} de {TELAS_REFERENCIA} telas</Linha>
        <Linha>{novo.limites.projetos >= Number.MAX_SAFE_INTEGER ? 'Projetos ilimitados' : `${novo.limites.projetos} projetos`} · apresentações de até {novo.limites.telasPorPrompt} telas com IA</Linha>
        <Linha>{novo.capacidades.senhaNoLink ? 'Links com senha e métricas de visualização' : 'Links privados (senha a partir do Pro)'}</Linha>
        {!novo.capacidades.marcaDaPlataforma && <Linha>Sem a marca Mostra nas apresentações</Linha>}
      </ul>
      {!upgrade && excede && <p className="mt-4 rounded-lg bg-aviso/15 px-3 py-2.5 text-[12px] leading-relaxed text-texto">Você tem {u.projetosAtivos} projetos ativos e o {novo.nome} permite {novo.limites.projetos}. Nada é apagado: os projetos continuam abertos e os links funcionando, mas novos projetos ficam bloqueados.</p>}
      <p className="mt-4 text-[12px] text-texto3">Modo demonstração: a troca é imediata e nenhuma cobrança é feita.</p>
    </Modal>
  )
}

function Linha({ children }: { children: React.ReactNode }) {
  return <li className="flex items-start gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sucesso" />{children}</li>
}

/** Cartão de créditos do painel: saldo em créditos e em apresentações, plano e próximos passos. */
export function CartaoCreditos({ className }: { className?: string }) {
  const saldo = useDemo((e) => e.creditos.saldo)
  const ws = useDemo((e) => e.workspace)
  const plano = PLANOS[ws.planoId]
  const { abrirCompra } = useCreditos()
  const n = apresentacoesCom(saldo)
  const pct = Math.min(100, Math.round((saldo / Math.max(plano.creditos.quantidade, 1)) * 100))
  const pouco = n < 2
  return (
    <section aria-labelledby="titulo-creditos" className={cx('flex flex-col rounded-xl border border-borda bg-superficie p-5', className)}>
      <div className="flex items-center justify-between gap-2">
        <h2 id="titulo-creditos" className="rotulo-mono">Créditos de IA</h2>
        <Link href="/app/settings#plano" className="text-[12px] text-texto2 hover:text-texto">Plano {plano.nome}</Link>
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <Sparkles className="h-4 w-4 self-center text-acento" />
        <span className="text-[28px] font-medium leading-none tracking-[-0.04em]">{fmt(saldo)}</span>
        <span className="text-[13px] text-texto2">créditos</span>
      </div>
      <p className={cx('mt-1.5 text-[13px]', pouco ? 'text-perigo' : 'text-texto2')}>{n > 0 ? `${textoApresentacoes(saldo)} de ${TELAS_REFERENCIA} telas restantes` : 'Não dá para gerar uma apresentação de 10 telas'}</p>
      <div className="mt-3 h-[3px] overflow-hidden rounded-sm bg-borda" aria-hidden><div className={cx('h-full', pouco ? 'bg-perigo' : 'bg-acento')} style={{ width: `${Math.max(2, pct)}%` }} /></div>
      <p className="mt-2 text-[11px] text-texto3">{plano.creditos.recorrencia === 'mensal' ? `Renova ${fmt(plano.creditos.quantidade)} por mês` : `${fmt(plano.creditos.quantidade)} créditos de boas-vindas`} · editar, apresentar e enviar não gastam créditos</p>
      <div className="mt-auto flex gap-2 pt-4">
        <Botao tamanho="sm" variante="secundario" className="flex-1" onClick={() => abrirCompra()}>Comprar créditos</Botao>
        <Link href="/app/settings#plano" className="inline-flex h-8 flex-1 items-center justify-center rounded-md border-[1.5px] border-transparent px-3 text-[13px] font-medium text-texto hover:bg-hover">{ws.planoId === 'studio' ? 'Ver uso' : 'Ver planos'}</Link>
      </div>
    </section>
  )
}
