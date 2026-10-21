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
