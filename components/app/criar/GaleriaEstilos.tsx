'use client'
/**
 * Galeria de estilos de design: miniaturas reais (montadas pelo motor do design system e desenhadas pelo próprio
 * renderer), com a marca da pessoa já aplicada, filtro por categoria e busca. Escolher ou trocar estilo é grátis.
 */
import { useEffect, useMemo, useState } from 'react'
import { Check, Search, Sparkles } from 'lucide-react'
import { cx } from '@/components/ui'
import type { AssetsResolvidos } from '@/components/renderer/SceneRenderer'
import { carregarFontes } from '@/components/renderer/fontes'
import { CATEGORIAS_ESTILO, NOMES_CATEGORIA, TEMAS, regrasDe, type CategoriaEstilo, type Marca, type TemaId, type TemaVisual } from '@/lib/ia/designSystem'
import type { LogoMontagem } from '@/lib/ia/montagem'
import { montarDocumento, type Estilo, type Roteiro } from '@/lib/ia/roteiro'
import type { DocumentoProjeto } from '@/lib/scene/schema'
import { MiniaturaFluida } from './ui'

/** Apresentação de amostra das miniaturas: a capa usa o título do briefing. */
export function roteiroAmostra(titulo: string, nomeMarca = ''): Roteiro {
  const t = titulo.trim().slice(0, 60) || 'Sua apresentação aqui'
  return {
    titulo: t,
    telas: [
      { tipo: 'capa', rotulo: nomeMarca.slice(0, 30), titulo: t, texto: 'Proposta · 2026', itens: [], notas: '' },
      { tipo: 'cartoes', rotulo: 'Pilares', titulo: 'Três ideias que guiam o projeto', texto: '', itens: ['Estratégia|o porquê de cada escolha', 'Identidade|marca e aplicações', 'Lançamento|plano de estreia'], notas: '' },
      { tipo: 'numeros', rotulo: 'Resultados', titulo: 'O que esperamos medir', texto: '', itens: ['+38%|engajamento', '2×|conversão', '6 sem.|até o lançamento'], notas: '' },
    ],
  }
}

export interface PropsGaleria {
  valor: TemaId | 'auto'
  aoEscolher: (id: TemaId | 'auto') => void
  /** Marca aplicada nas miniaturas. */
  marca: Marca
  logo: LogoMontagem | null
  assets: AssetsResolvidos
  titulo: string
  /** Energia escolhida (null = a do estilo). */
  energia: Estilo | null
  /** Mostra o cartão "Deixar a IA sugerir". */
  comAuto?: boolean
  /** Estilo sugerido pela IA (selo). */
  sugerido?: TemaId | null
}

export function GaleriaEstilos({ valor, aoEscolher, marca, logo, assets, titulo, energia, comAuto = true, sugerido }: PropsGaleria) {
  const [categoria, setCategoria] = useState<CategoriaEstilo | 'todos'>('todos')
  const [busca, setBusca] = useState('')
  useEffect(() => { carregarFontes(TEMAS.flatMap((t) => [t.fontes.titulo, t.fontes.texto])) }, [])
  const roteiro = useMemo(() => roteiroAmostra(titulo, marca.nome), [titulo, marca.nome])
  const docs = useMemo(() => {
    const m = new Map<string, DocumentoProjeto>()
    for (const t of TEMAS as readonly TemaVisual[]) m.set(t.id, montarDocumento(roteiro, { modo: 'slides', tema: t.id as TemaId, estilo: energia ?? regrasDe(t).energia, marca, logo }))
    return m
  }, [roteiro, marca, logo, energia])
  const q = busca.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const visiveis = (TEMAS as readonly TemaVisual[]).filter((t) => (categoria === 'todos' || t.categoria === categoria) && (!q || `${t.nome} ${t.descricao} ${t.tags ?? ''} ${t.categoria ?? ''}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(q)))
  const contagem = (c: CategoriaEstilo) => TEMAS.filter((t) => t.categoria === c).length
  const escolhido = valor === 'auto' ? null : docs.get(valor)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div role="radiogroup" aria-label="Categoria de estilo" className="flex min-w-0 flex-1 flex-wrap gap-1.5">
          {(['todos', ...CATEGORIAS_ESTILO] as const).map((c) => (
            <button key={c} type="button" role="radio" aria-checked={categoria === c} onClick={() => setCategoria(c)} className={cx('rounded-full border-[1.5px] px-3 py-1 text-[12px] font-medium transition-colors', categoria === c ? 'border-grafite bg-grafite text-fundo' : 'border-[#E2E1DE] bg-white text-[#525252] hover:border-grafite hover:text-texto')}>
              {c === 'todos' ? `Todos · ${TEMAS.length}` : `${NOMES_CATEGORIA[c]} · ${contagem(c)}`}
            </button>
          ))}
        </div>
        <label className="flex h-9 w-full items-center gap-2 rounded-full border-[1.5px] border-[#E2E1DE] bg-white px-3 text-[13px] sm:w-[220px]">
          <Search className="h-3.5 w-3.5 shrink-0 text-texto3" aria-hidden />
          <input aria-label="Buscar estilo" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar: luxo, tech, aula…" className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-[#B5B5B5]" />
        </label>
      </div>

      {escolhido && (
        <div className="grid grid-cols-3 gap-2 rounded-[14px] bg-[#F5F5F4] p-2" aria-label="Prévia do estilo escolhido">
          {escolhido.scenes.map((c) => <div key={c.id} className="overflow-hidden rounded-md shadow-[0_1px_2px_rgba(0,0,0,0.06)]"><MiniaturaFluida cena={c} assets={assets} /></div>)}
        </div>
      )}

      <div role="radiogroup" aria-label="Estilo de design" className="grid grid-cols-[repeat(auto-fill,minmax(min(190px,100%),1fr))] gap-3">
        {comAuto && categoria === 'todos' && !q && (
          <button type="button" role="radio" aria-checked={valor === 'auto'} onClick={() => aoEscolher('auto')} className="group flex flex-col gap-1.5 text-left">
            <span className={cx('flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-lg border-[1.5px] border-dashed bg-white outline outline-2 outline-offset-2', valor === 'auto' ? 'border-violeta outline-violeta' : 'border-[#D6D4D0] outline-transparent group-hover:border-grafite')}>
              <Sparkles className="h-5 w-5 text-acento" aria-hidden />
              <span className="px-3 text-center text-[12px] text-texto2">A IA escolhe pelo assunto</span>
            </span>
            <span className="text-[13px] font-medium">Sugestão da IA</span>
          </button>
        )}
        {visiveis.map((t) => {
          const cena = docs.get(t.id)?.scenes[0]
          const ativo = valor === t.id
          return (
            <button key={t.id} type="button" role="radio" aria-checked={ativo} aria-label={t.nome} title={t.descricao} onClick={() => aoEscolher(t.id as TemaId)} className="group flex min-w-0 flex-col gap-1.5 text-left">
              <span className={cx('relative block w-full overflow-hidden rounded-lg shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)] outline outline-2 outline-offset-2 transition-[outline-color]', ativo ? 'outline-violeta' : 'outline-transparent group-hover:outline-[#D6D4D0]')}>
                {cena && <MiniaturaFluida cena={cena} assets={assets} />}
                {ativo && <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-violeta text-white"><Check className="h-3 w-3" /></span>}
                {sugerido === t.id && <span className="mono absolute left-1.5 top-1.5 rounded-full bg-white/90 px-1.5 py-0.5 text-[8px] font-medium text-[#171717]">SUGERIDO</span>}
              </span>
              <span className="flex min-w-0 items-baseline justify-between gap-2">
                <span className="truncate text-[13px] font-medium">{t.nome}</span>
                <span className="mono shrink-0 text-[10px] uppercase tracking-[0.04em] text-texto3">{t.categoria ? NOMES_CATEGORIA[t.categoria] : ''}</span>
              </span>
            </button>
          )
        })}
      </div>
      {!visiveis.length && <p className="text-center text-[13px] text-texto3">Nenhum estilo com “{busca}”. Tente “minimal”, “escuro” ou “divertido”.</p>}
    </div>
  )
}
