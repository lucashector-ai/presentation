/** Ícones dos tipos de guia de layout (14 px, no traço dos ícones do painel Design). */
import type { GuiaLayout } from '@/lib/scene/schema'

const base = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true }

export const IconeGuiaGrade = () => (
  <svg viewBox="0 0 14 14" className="h-3.5 w-3.5" {...base}>
    <rect x="1.5" y="1.5" width="11" height="11" rx="1.5" /><path d="M5.17 1.5v11M8.83 1.5v11M1.5 5.17h11M1.5 8.83h11" />
  </svg>
)
export const IconeGuiaColunas = () => (
  <svg viewBox="0 0 14 14" className="h-3.5 w-3.5" {...base}>
    <path d="M2.5 1.5v11M5.5 1.5v11M8.5 1.5v11M11.5 1.5v11" /><path d="M1.5 1.5h11M1.5 12.5h11" opacity=".5" />
  </svg>
)
export const IconeGuiaLinhas = () => (
  <svg viewBox="0 0 14 14" className="h-3.5 w-3.5" {...base}>
    <path d="M1.5 2.5h11M1.5 5.5h11M1.5 8.5h11M1.5 11.5h11" /><path d="M1.5 1.5v11M12.5 1.5v11" opacity=".5" />
  </svg>
)

export const ICONE_GUIA: Record<GuiaLayout['type'], () => React.JSX.Element> = { grid: IconeGuiaGrade, columns: IconeGuiaColunas, rows: IconeGuiaLinhas }
