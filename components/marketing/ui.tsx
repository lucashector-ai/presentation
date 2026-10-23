import type { CSSProperties, ReactNode } from 'react'
import type { TipoForma } from './dados'

/** Container das seções: 1360px como no design, gutter de 16px no celular e 32px a partir de sm. */
export const CONTEUDO = 'relative mx-auto w-full max-w-[1360px] px-4 sm:px-8'

/** Triângulo com a ponta para cima (clip-path). */
export const TRIANGULO = '[clip-path:polygon(50%_0,100%_100%,0_100%)]'

const BOTAO = 'inline-flex items-center justify-center gap-2 rounded-full border-2 border-tinta font-semibold transition-[transform,box-shadow,background-color,color] duration-150 motion-reduce:transition-none'
const LEVANTA = 'hover:-translate-x-0.5 hover:-translate-y-0.5 motion-reduce:hover:translate-x-0 motion-reduce:hover:translate-y-0'
/** Botão de tinta (grafite no claro, off-white no escuro) com sombra "carimbo" colorida — combine com uma classe de sombra (ex.: shadow-[5px_5px_0_#E4572E]). */
export const BOTAO_ESCURO = `${BOTAO} ${LEVANTA} bg-acao text-acaoTexto hover:text-acaoTexto`
/** Botão de superfície com contorno; no hover vira lima. Ao lado de um BOTAO_ESCURO, deixe calha de 16 (a sombra carimbo dele avança 5–7 px). */
export const BOTAO_CLARO = `${BOTAO} bg-superficie text-texto hover:bg-lima hover:text-texto`

const FORMAS: Record<TipoForma, string> = {
  circulo: 'rounded-full',
  quadrado: '',
  quadradoSuave: 'rounded-[2px]',
  triangulo: TRIANGULO,
  semicirculo: 'rounded-t-full',
}

/** Marcador geométrico decorativo (sempre aria-hidden). Defina o tamanho via className. */
export function Forma({ tipo, cor, className = '', style }: { tipo: TipoForma; cor: string; className?: string; style?: CSSProperties }) {
  return <span aria-hidden className={`block shrink-0 ${FORMAS[tipo]} ${className}`} style={{ background: cor, ...style }} />
}

/** Rótulo mono em caixa-alta acima dos títulos de seção. */
export function Rotulo({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={`m-0 font-mono text-[13px] uppercase tracking-[0.06em] ${className}`}>{children}</p>
}

/** `equilibrar` aplica text-wrap: balance (como no design, exceto onde a quebra natural é a desejada). */
export function TituloSecao({ children, className = '', equilibrar = true }: { children: ReactNode; className?: string; equilibrar?: boolean }) {
  return <h2 className={`m-0 text-[clamp(40px,5.4vw,84px)] font-semibold leading-[0.95] tracking-[-0.05em] ${equilibrar ? '[text-wrap:balance]' : ''} ${className}`}>{children}</h2>
}

/** Fundo de pontos (radial-gradient) usado nas composições. */
export const pontos = (cor: string, raio: number, passo: number): CSSProperties => ({
  backgroundImage: `radial-gradient(${cor} ${raio}px, transparent ${raio + 0.5}px)`,
  backgroundSize: `${passo}px ${passo}px`,
})

/** Hachura diagonal na cor da tinta. */
export const hachura = (traco = '4px', vao = '12px'): CSSProperties => ({
  backgroundImage: `repeating-linear-gradient(-45deg, rgb(var(--cor-tinta)) 0 ${traco}, transparent ${traco} ${vao})`,
})
