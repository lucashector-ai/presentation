'use client'
/**
 * Linha de preenchimento (como no Figma): [amostra] D9D9D9 | 100 % — clique na amostra abre o seletor de cor.
 * `LinhaPintura` aceita sólido, gradiente e imagem; `CampoCor` é o atalho para uma cor sólida (opcional).
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link2Off } from 'lucide-react'
import type { EstiloCor } from '@/lib/scene/schema'
import { alfaDe, comAlfa, hex6, lerCor, rgbaParaHex } from '@/lib/editor/cor'
import { cx } from '@/components/ui'
import { CampoNum } from './campos'
import { useInspetor } from './contexto'
import { SeletorCor, XADREZ, cssPintura, type Pintura, type TipoPintura } from './SeletorCor'

const NOME_GRADIENTE: Record<string, string> = { linear: 'Linear', radial: 'Radial' }

export function LinhaPintura({ rotulo, valor, aoMudar, tipos = ['solido'], acoes, vazio, placeholder, aoLimpar, estiloId, aoEstilo }: {
  rotulo: string
  valor: Pintura
  aoMudar: (p: Pintura) => void
  tipos?: TipoPintura[]
  /** Botões à direita (olho, −). */
  acoes?: ReactNode
  /** Sem cor (campo opcional vazio). */
  vazio?: boolean
  placeholder?: string
  /** Apagar o texto remove a cor (campos opcionais). */
  aoLimpar?: () => void
  /** Estilo de cor ligado (mostra o nome no lugar do hex, com "Desvincular"). */
  estiloId?: string
  aoEstilo?: (e: EstiloCor) => void
}) {
  const { imagens, estilos } = useInspetor()
  const estilo = estiloId ? estilos?.lista.find((e) => e.id === estiloId) : undefined
  const [aberto, setAberto] = useState(false)
  const caixa = useRef<HTMLDivElement>(null)
  const imagem = valor.tipo === 'imagem' ? imagens.find((i) => i.id === valor.assetId) : undefined
  const css = vazio ? undefined : cssPintura(valor, imagem?.url)
  const solido = valor.tipo === 'solido' ? valor.cor : undefined
  const transparente = solido !== undefined && alfaDe(solido) < 1
  return (
    <div className="flex items-center gap-1">
      <div ref={caixa} className={cx('flex h-6 min-w-0 flex-1 items-center rounded-md bg-superficie2 ring-inset transition-shadow hover:ring-1 hover:ring-bordaForte focus-within:!ring-1 focus-within:!ring-acento', aberto && '!ring-1 !ring-acento')}>
        <button
          type="button"
          aria-label={`${rotulo}: escolher cor`}
          aria-haspopup="dialog"
          aria-expanded={aberto}
          onClick={() => setAberto((v) => !v)}
          className="ml-[5px] h-3.5 w-3.5 shrink-0 rounded-[3px] shadow-[inset_0_0_0_1px_rgba(0,0,0,.12)] outline-none focus-visible:ring-2 focus-visible:ring-acento"
          style={{ background: !css ? XADREZ : transparente ? `linear-gradient(90deg, ${comAlfa(solido!, 1)} 50%, transparent 50%), linear-gradient(${solido}, ${solido}), ${XADREZ}` : css }}
        />
        {estilo && valor.tipo === 'solido' ? (
          <>
            <button type="button" title={`Estilo de cor: ${estilo.name}`} onClick={() => setAberto((v) => !v)} className="h-full min-w-0 flex-1 truncate pl-2 text-left text-[11px] text-texto">{estilo.name}</button>
            <button type="button" aria-label="Desvincular estilo" title="Desvincular estilo (mantém a cor)" onClick={() => aoMudar({ tipo: 'solido', cor: valor.cor })} className="mr-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[4px] text-texto2 hover:text-texto"><Link2Off className="h-3 w-3" /></button>
          </>
        ) : valor.tipo === 'solido' ? (
          <>
            <CampoHexLinha rotulo={rotulo} cor={vazio ? undefined : valor.cor} placeholder={placeholder} aoLimpar={aoLimpar} aoMudar={(cor) => aoMudar({ tipo: 'solido', cor })} />
            {!vazio && (
              <>
                <span className="h-4 w-px shrink-0 bg-bordaForte" aria-hidden />
                <CampoNum rotulo={`${rotulo}: opacidade`} valor={Math.round(alfaDe(valor.cor) * 100)} min={0} max={100} sufixo="%" semMoldura className="w-[54px] !flex-none !pl-1.5" aoMudar={(a) => aoMudar({ tipo: 'solido', cor: comAlfa(valor.cor, a / 100) })} />
              </>
            )}
          </>
        ) : (
          <button type="button" onClick={() => setAberto((v) => !v)} className="h-full min-w-0 flex-1 truncate pl-2 pr-2 text-left text-[11px] text-texto">
            {valor.tipo === 'gradiente' ? NOME_GRADIENTE[valor.gradiente.type] : imagem?.nome ?? 'Imagem'}
          </button>
        )}
      </div>
      {acoes}
      {aberto && <SeletorCor ancora={caixa.current} titulo={rotulo} valor={vazio && valor.tipo === 'solido' ? { tipo: 'solido', cor: '#FFFFFF' } : valor} tipos={tipos} aoMudar={aoMudar} aoFechar={() => setAberto(false)} estiloId={estilo?.id} aoEstilo={aoEstilo} />}
    </div>
  )
}

function CampoHexLinha({ rotulo, cor, aoMudar, placeholder, aoLimpar }: { rotulo: string; cor: string | undefined; aoMudar: (c: string) => void; placeholder?: string; aoLimpar?: () => void }) {
  const exibido = cor ? hex6(cor) : ''
  const [texto, setTexto] = useState(exibido)
  const focado = useRef(false)
  const cancelar = useRef(false)
  useEffect(() => { if (!focado.current) setTexto(exibido) }, [exibido])
  const confirmar = () => {
    if (cancelar.current) { cancelar.current = false; setTexto(exibido); return }
    if (texto === exibido) return
    if (!texto.trim() && aoLimpar) { aoLimpar(); return }
    const rgb = lerCor(texto)
    if (!rgb) { setTexto(exibido); return }
    // "D9D9D9" mantém a opacidade atual; "#D9D9D980" ou rgba() trazem a própria
    aoMudar(rgbaParaHex({ ...rgb, a: rgb.a < 1 ? rgb.a : cor ? alfaDe(cor) : 1 }))
  }
  return (
    <input
      aria-label={rotulo}
      value={texto}
      placeholder={placeholder}
      spellCheck={false}
      maxLength={40}
      onFocus={(e) => { focado.current = true; e.currentTarget.select() }}
      onChange={(e) => setTexto(e.target.value)}
      onBlur={() => { focado.current = false; confirmar() }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        if (e.key === 'Escape') { e.stopPropagation(); cancelar.current = true; (e.target as HTMLInputElement).blur() }
      }}
      className="h-full w-full min-w-0 bg-transparent pl-2 text-[11px] uppercase tabular-nums text-texto outline-none placeholder:normal-case placeholder:text-texto3"
    />
  )
}

/** Cor sólida (sombra, troca de cor do SVG, fundo do 3D…). `permitirVazio`: apagar o texto remove a cor. */
export function CampoCor({ valor, aoMudar, rotulo, permitirVazio }: { valor: string | undefined; aoMudar: (v: string | undefined) => void; rotulo: string; permitirVazio?: boolean }) {
  return (
    <div className="min-w-0 flex-1">
      <LinhaPintura
        rotulo={rotulo}
        vazio={!valor}
        placeholder={permitirVazio ? 'Nenhuma' : undefined}
        valor={{ tipo: 'solido', cor: valor ?? '#FFFFFF' }}
        aoMudar={(p) => p.tipo === 'solido' && aoMudar(p.cor)}
        aoLimpar={permitirVazio ? () => aoMudar(undefined) : undefined}
      />
    </div>
  )
}

/**
 * Cor simples (só sólida) como amostra clicável que abre o SeletorCor: substitui o <input type="color"> nativo nos
 * campos de animação, guias e afins, para toda cor do app usar o mesmo seletor (conta-gotas, hex/RGB, recentes).
 */
export function BotaoCor({ rotulo, cor, aoMudar, className }: { rotulo: string; cor: string; aoMudar: (cor: string) => void; className?: string }) {
  const [aberto, setAberto] = useState(false)
  const caixa = useRef<HTMLButtonElement>(null)
  return (
    <>
      <button ref={caixa} type="button" aria-label={rotulo} title={rotulo} onClick={() => setAberto((a) => !a)} className={`relative h-6 w-8 shrink-0 overflow-hidden rounded-md border border-borda ${className ?? ''}`} style={{ backgroundImage: XADREZ, backgroundSize: '8px 8px' }}>
        <span className="absolute inset-0" style={{ background: cor }} />
      </button>
      {aberto && <SeletorCor ancora={caixa.current} titulo={rotulo} valor={{ tipo: 'solido', cor }} aoMudar={(p) => { if (p.tipo === 'solido') aoMudar(p.cor) }} aoFechar={() => setAberto(false)} />}
    </>
  )
}

