/**
 * Peças de layout das telas do painel: um grid só para todas as telas (4 colunas no celular, 8 no tablet e com a
 * barra lateral, 12 a partir de xl; calha 16 → 24; largura máxima 1248, alinhada à barra lateral — o main do Shell
 * para em 1248 + margens; sem barra lateral, como no Novo projeto, fica centralizada). Valores em
 * lib/design-tokens.ts › T.layout. Tudo que fica lado a lado numa tela entra numa `Grade` com um `SPAN`, assim as
 * bordas de coluna batem entre as linhas por construção. Espaçamentos só em múltiplos de 8 (4 só dentro de
 * componentes), conferidos por components/app/espacamento.test.ts.
 */
import type { ReactNode } from 'react'

// cópia local do cx de components/ui (módulo de cliente): assim estas peças também servem a páginas de servidor
const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(' ')

/** Contêiner de toda tela do painel: largura máxima do grid (com a barra lateral, o main já para nessa largura; sem ela, centraliza). */
export function PaginaPainel({ children, className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cx('mx-auto w-full max-w-painel', className)} {...rest}>{children}</div>
}

/** Cabeçalho da tela: rótulo mono → H1 (8) → descrição (16); 32 até o primeiro bloco. A ação fica à direita. */
export function CabecalhoPagina({ rotulo, titulo, descricao, acao, className }: { rotulo: ReactNode; titulo: ReactNode; descricao?: ReactNode; acao?: ReactNode; className?: string }) {
  return (
    <header className={cx('mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0">
        <p className="rotulo-mono">{rotulo}</p>
        <h1 className="titulo-display mt-2 text-[32px] sm:text-[40px]">{titulo}</h1>
        {descricao && <p className="mt-4 max-w-[640px] text-[14px] text-texto2">{descricao}</p>}
      </div>
      {acao && <div className="flex shrink-0 flex-wrap items-center gap-2">{acao}</div>}
    </header>
  )
}

type ElementoGrade = 'div' | 'ul' | 'ol' | 'dl' | 'section' | 'nav'

/** O grid do painel. Os filhos escolhem a largura com `SPAN`; a calha (16 → 24) vale para linhas e colunas. */
export function Grade({ children, className, as: Elemento = 'div', ...rest }: { children: ReactNode; className?: string; as?: ElementoGrade } & Omit<React.HTMLAttributes<HTMLElement>, 'children' | 'className'>) {
  return <Elemento className={cx('grid grid-cols-4 gap-4 sm:grid-cols-8 sm:gap-6 xl:grid-cols-12', className)} {...rest}>{children}</Elemento>
}

/** Larguras no grid (celular / tablet e lg / xl). */
export const SPAN = {
  /** linha inteira */
  cheio: 'col-span-4 sm:col-span-8 xl:col-span-12',
  /** 2/3 no xl, cheio abaixo (IA, blocos principais) */
  doisTercos: 'col-span-4 sm:col-span-8',
  /** 1/3 no xl, metade no tablet, cheio no celular (cartões, capas de projeto) */
  terco: 'col-span-4',
  /** metade no xl e no tablet, cheio no celular */
  metade: 'col-span-4 xl:col-span-6',
  /** 1/4 no xl, metade no tablet e no celular (KPIs) */
  quarto: 'col-span-2 sm:col-span-4 xl:col-span-3',
  /** 1/6 no xl, 1/4 no tablet, metade no celular (miniaturas) */
  sexto: 'col-span-2',
  /** coluna lateral: 1/3 no xl, cheia abaixo */
  lateral: 'col-span-4 sm:col-span-8 xl:col-span-4',
} as const

/** Seção da tela: 48 acima, H2 de 20 px numa linha de 40 (alinha com os controles à direita) e 16 até o conteúdo. */
export function Secao({ titulo, descricao, acao, children, id, idTitulo, className }: { titulo: ReactNode; descricao?: ReactNode; acao?: ReactNode; children: ReactNode; id?: string; idTitulo?: string; className?: string }) {
  return (
    <section id={id} aria-labelledby={idTitulo} className={cx('mt-12 scroll-mt-8', className)}>
      <div className="flex min-h-10 flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 id={idTitulo} className="text-[20px] font-medium leading-7 tracking-[-0.02em]">{titulo}</h2>
          {descricao && <p className="mt-1 text-[13px] text-texto2">{descricao}</p>}
        </div>
        {acao}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  )
}

/**
 * Cartão do painel: ocupa a altura da linha (cartões vizinhos ficam iguais) e o rodapé vai para o pé, então os botões
 * de cartões lado a lado ficam na mesma linha. Cabeçalho numa linha de 24 (rótulo mono e link à direita), 16 até o corpo.
 */
export function CartaoPainel({ titulo, idTitulo, acao, rodape, children, className, tom = 'normal', ...rest }: { titulo: ReactNode; idTitulo: string; acao?: ReactNode; rodape?: ReactNode; children?: ReactNode; className?: string; tom?: 'normal' | 'perigo' } & Omit<React.HTMLAttributes<HTMLElement>, 'children' | 'className' | 'title'>) {
  return (
    <section aria-labelledby={idTitulo} className={cx('flex h-full min-w-0 flex-col rounded-cartao border bg-superficie p-4 sm:p-6', tom === 'perigo' ? 'border-perigo/40' : 'border-borda', className)} {...rest}>
      <div className="flex h-6 items-center justify-between gap-2">
        <h2 id={idTitulo} className="rotulo-mono truncate">{titulo}</h2>
        {acao}
      </div>
      <div className="mt-4 flex min-w-0 flex-1 flex-col">{children}</div>
      {rodape && <div className="mt-auto flex gap-2 pt-6">{rodape}</div>}
    </section>
  )
}

/** Bloco de esqueleto (carregando): mantém o tamanho do que vai chegar, para nada pular. */
export function Esqueleto({ className }: { className?: string }) {
  return <div aria-hidden className={cx('animate-pulse rounded-controle bg-superficie2', className)} />
}

/** Fichas de filtro (abas do Início, tipos da Biblioteca): pill de 32, 16 de padding lateral, contagem opcional. */
export function FiltroFichas<T extends string>({ opcoes, valor, aoMudar, rotulo, abas, className }: { opcoes: readonly { id: T; rotulo: string; contagem?: number }[]; valor: T; aoMudar: (v: T) => void; rotulo: string; abas?: boolean; className?: string }) {
  return (
    <div className={cx('flex gap-1 whitespace-nowrap text-[14px]', className)} role={abas ? 'tablist' : 'group'} aria-label={rotulo}>
      {opcoes.map((o) => {
        const ativo = valor === o.id
        return (
          <button key={o.id} type="button" role={abas ? 'tab' : undefined} aria-selected={abas ? ativo : undefined} aria-pressed={abas ? undefined : ativo} onClick={() => aoMudar(o.id)} className={cx('flex h-8 shrink-0 items-center gap-2 rounded-full px-4 transition-colors', ativo ? 'bg-acao text-acaoTexto' : 'text-texto2 hover:bg-hover hover:text-texto')}>
            {o.rotulo}
            {o.contagem !== undefined && <span className={cx('text-[12px]', ativo ? 'text-fundo/60' : 'text-texto3')}>{o.contagem}</span>}
          </button>
        )
      })}
    </div>
  )
}
