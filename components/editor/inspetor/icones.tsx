/** Ícones pequenos (12–16 px) do painel Design, desenhados no traço do lucide (1.5). */
const base = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true }

export const IconeOpacidade = () => (
  <svg viewBox="0 0 12 12" className="h-3 w-3" {...base}>
    <rect x="1.5" y="1.5" width="9" height="9" rx="1.5" />
    <path d="M1.5 6h4.5V1.5M6 6v4.5h4.5V6" fill="currentColor" fillOpacity=".35" stroke="none" />
  </svg>
)
export const IconeRaio = () => (
  <svg viewBox="0 0 12 12" className="h-3 w-3" {...base}>
    <path d="M2 10.5V6a4 4 0 0 1 4-4h4.5" />
  </svg>
)
export const IconeCantos = () => (
  <svg viewBox="0 0 14 14" className="h-3.5 w-3.5" {...base}>
    <path d="M1.5 5V3.5a2 2 0 0 1 2-2H5M9 1.5h1.5a2 2 0 0 1 2 2V5M12.5 9v1.5a2 2 0 0 1-2 2H9M5 12.5H3.5a2 2 0 0 1-2-2V9" />
  </svg>
)
export const IconeEspessura = () => (
  <svg viewBox="0 0 12 12" className="h-3 w-3" {...base}>
    <path d="M1.5 2.5h9" strokeWidth="1" /><path d="M1.5 6h9" strokeWidth="1.8" /><path d="M1.5 9.75h9" strokeWidth="2.5" />
  </svg>
)
export const IconeTracejado = () => (
  <svg viewBox="0 0 12 12" className="h-3 w-3" {...base}>
    <path d="M1.5 6h2M5 6h2M8.5 6h2" strokeWidth="1.8" />
  </svg>
)
export const IconeMesclagem = () => (
  <svg viewBox="0 0 14 14" className="h-3.5 w-3.5" {...base}>
    <circle cx="5.25" cy="7" r="3.75" /><circle cx="8.75" cy="7" r="3.75" />
  </svg>
)
export const IconeEstilos = () => (
  <svg viewBox="0 0 14 14" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
    <circle cx="4" cy="4" r="1.4" /><circle cx="10" cy="4" r="1.4" /><circle cx="4" cy="10" r="1.4" /><circle cx="10" cy="10" r="1.4" />
  </svg>
)
export const IconeAjustes = () => (
  <svg viewBox="0 0 14 14" className="h-3.5 w-3.5" {...base}>
    <path d="M2 4h6M11 4h1M2 10h1M6 10h6" /><circle cx="9.5" cy="4" r="1.5" /><circle cx="4.5" cy="10" r="1.5" />
  </svg>
)
export const IconeSombra = () => (
  <svg viewBox="0 0 14 14" className="h-3.5 w-3.5" {...base}>
    <rect x="1.5" y="1.5" width="8" height="8" rx="1.5" /><path d="M11.5 4.5v5a2 2 0 0 1-2 2h-5" opacity=".5" />
  </svg>
)
export const IconeDesfoque = () => (
  <svg viewBox="0 0 14 14" className="h-3.5 w-3.5" {...base}>
    <circle cx="7" cy="7" r="5.25" strokeDasharray="1.6 1.6" /><circle cx="7" cy="7" r="2" />
  </svg>
)
export const IconeVidro = () => (
  <svg viewBox="0 0 14 14" className="h-3.5 w-3.5" {...base}>
    <rect x="1.5" y="1.5" width="11" height="11" rx="2" strokeDasharray="1.6 1.6" /><path d="M4.5 9.5l5-5" />
  </svg>
)
export const IconeEntrelinha = () => (
  <svg viewBox="0 0 12 12" className="h-3 w-3" {...base}>
    <path d="M1.5 1.5h9M1.5 10.5h9M6 3.5v5M4.5 5 6 3.5 7.5 5M4.5 7 6 8.5 7.5 7" />
  </svg>
)
export const IconeEspacamento = () => (
  <svg viewBox="0 0 12 12" className="h-3 w-3" {...base}>
    <path d="M1.5 1.5v9M10.5 1.5v9M3.5 6h5M5 4.5 3.5 6 5 7.5M7 4.5 8.5 6 7 7.5" />
  </svg>
)
export const IconeTamanho = () => (
  <svg viewBox="0 0 12 12" className="h-3 w-3" {...base}>
    <path d="M1.5 3V1.75h6V3M4.5 1.75v8.5M3.5 10.25h2M7.5 6.5V5.75h3.25v.75M9.1 5.75v4.5M8.5 10.25h1.25" />
  </svg>
)
export const IconeSuavizacao = () => (
  <svg viewBox="0 0 12 12" className="h-3 w-3" {...base}>
    <path d="M2 10.5V7.2C2 3.8 3.8 2 7.2 2h3.3" />
  </svg>
)

/**
 * Auto layout no padrão do Figma: barras empilhadas na direção do fluxo (horizontal = barras lado a lado,
 * vertical = uma sobre a outra, quebra = grade 2 × 2). `mais` = versão "adicionar" (com +).
 */
export function IconeAutoLayout({ direcao = 'vertical', className = 'h-3.5 w-3.5', mais }: { direcao?: 'horizontal' | 'vertical' | 'wrap'; className?: string; mais?: boolean }) {
  return (
    <svg viewBox="0 0 16 16" className={className} {...base} strokeWidth={1.3}>
      {direcao === 'horizontal' ? (
        <><rect x="2" y="3.5" width="4.5" height="9" rx="1.2" /><rect x="9.5" y="3.5" width="4.5" height="9" rx="1.2" /></>
      ) : direcao === 'wrap' ? (
        <><rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1.1" /><rect x="9" y="2.5" width="4.5" height="4.5" rx="1.1" /><rect x="2.5" y="9" width="4.5" height="4.5" rx="1.1" />{!mais && <rect x="9" y="9" width="4.5" height="4.5" rx="1.1" />}</>
      ) : (
        <><rect x="3.5" y="2" width="9" height="4.5" rx="1.2" /><rect x="3.5" y="9.5" width="9" height="4.5" rx="1.2" /></>
      )}
      {mais && direcao === 'wrap' && <path d="M11.25 9.5v3.5M9.5 11.25H13" />}
    </svg>
  )
}

/** Posição do traço: linha tracejada = borda da camada; barra cheia = traço. */
export function IconePosicaoTraco({ posicao }: { posicao: 'inside' | 'center' | 'outside' }) {
  const y = posicao === 'inside' ? 7.5 : posicao === 'center' ? 5.5 : 3.5
  return (
    <svg viewBox="0 0 14 14" className="h-3.5 w-3.5" {...base}>
      <rect x="2" y={y} width="10" height="3" rx=".5" fill="currentColor" fillOpacity=".35" stroke="none" />
      <path d="M1.5 7h11" strokeDasharray="1.4 1.4" />
    </svg>
  )
}

export const IconeLados = () => (
  <svg viewBox="0 0 14 14" className="h-3.5 w-3.5" {...base}>
    <path d="M2 2h10" strokeWidth="2.2" /><path d="M12 2v10M12 12H2M2 12V2" opacity=".45" />
  </svg>
)

export const IconeLuz = () => (
  <svg viewBox="0 0 14 14" className="h-3.5 w-3.5" {...base}>
    <circle cx="7" cy="7" r="2.5" /><path d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13M2.8 2.8l1 1M10.2 10.2l1 1M2.8 11.2l1-1M10.2 3.8l1-1" />
  </svg>
)

export const IconeSombraRealista = () => (
  <svg viewBox="0 0 14 14" className="h-3.5 w-3.5" {...base}>
    <rect x="2" y="1.5" width="8" height="8" rx="1.5" />
    <path d="M3.5 11.2c2 .9 5.3 1 7.7-.4M11.6 3.4c.9 2 .9 4.6-.2 6.8" opacity=".5" />
  </svg>
)

export const IconeMascara = () => (
  <svg viewBox="0 0 14 14" className="h-3.5 w-3.5" {...base}>
    <rect x="1.5" y="1.5" width="11" height="11" rx="2" /><circle cx="7" cy="7" r="3" fill="currentColor" fillOpacity=".35" />
  </svg>
)

export const IconeSombraInterna = () => (
  <svg viewBox="0 0 14 14" className="h-3.5 w-3.5" {...base}>
    <rect x="1.5" y="1.5" width="11" height="11" rx="2" /><path d="M4 10V5.5A1.5 1.5 0 0 1 5.5 4H10" opacity=".5" />
  </svg>
)
