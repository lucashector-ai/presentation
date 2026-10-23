/** Tamanho da marca onde ela identifica o produto (cabeçalho da landing, barra lateral do painel, entrada e cadastro): um só, para ser a mesma logo em todo lugar. */
export const TAMANHO_MARCA = 'text-[28px] sm:text-[34px]'

/**
 * Wordmark da Mostra: o "m" é um traço contínuo (SVG do Claude Design) seguido de "ostra" em Geist.
 * Herda a cor do texto (currentColor) — use sobre qualquer par da paleta.
 */
export function Marca({ className, titulo = 'Mostra' }: { className?: string; titulo?: string }) {
  return (
    <span className={`inline-flex items-baseline whitespace-nowrap font-semibold leading-none ${className ?? ''}`} style={{ letterSpacing: '-0.04em' }} aria-label={titulo} role="img">
      <svg viewBox="-4 0 160 100" aria-hidden style={{ width: '0.848em', height: '0.53em', marginRight: '0.005em', overflow: 'visible', fill: 'none', flex: 'none' }}>
        <defs>
          <clipPath id="mostra-m">
            <rect x="-30" y="0" width="220" height="100" />
          </clipPath>
        </defs>
        <path clipPath="url(#mostra-m)" d="M4 112 L42 -6 C50 16 93 40 93 66 C93 81 84 89 72 89 C60 89 51 81 51 66 C51 40 74 11 104 11 C129 11 141 26 141 44 V112" stroke="currentColor" strokeWidth="22.5" strokeLinejoin="miter" strokeMiterlimit="10" />
      </svg>
      <span aria-hidden>ostra</span>
    </span>
  )
}

/** Só o símbolo "m" dentro de um quadrado (avatar do app, barra do editor). Por padrão segue o tema (tinta sobre fundo). O favicon é public/favicon.svg. */
export function Simbolo({ tamanho = 28, fundo = 'rgb(var(--cor-tinta))', tinta = 'rgb(var(--cor-fundo))', className }: { tamanho?: number; fundo?: string; tinta?: string; className?: string }) {
  return (
    <span className={`inline-flex items-center justify-center ${className ?? ''}`} style={{ width: tamanho, height: tamanho, borderRadius: tamanho * 0.25, background: fundo, color: tinta }} aria-hidden>
      <svg viewBox="-4 -10 160 120" style={{ width: '62%', height: '62%', fill: 'none', overflow: 'visible' }}>
        <path d="M4 112 L42 -6 C50 16 93 40 93 66 C93 81 84 89 72 89 C60 89 51 81 51 66 C51 40 74 11 104 11 C129 11 141 26 141 44 V112" stroke="currentColor" strokeWidth="22.5" strokeLinejoin="miter" strokeMiterlimit="10" />
      </svg>
    </span>
  )
}
