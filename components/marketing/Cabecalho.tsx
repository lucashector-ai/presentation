import Link from 'next/link'
import { Marca, TAMANHO_MARCA } from '@/components/ui/Logo'
import { NAV, ROTAS } from './dados'
import { BOTAO_ESCURO } from './ui'
import { MenuMovel } from './MenuMovel'

/** Selo "DEMO" no canto da logo enquanto o produto está em demonstração. Só na landing; tire daqui quando sair da demo. */
const SELO_DEMO = true

export function Cabecalho() {
  return (
    <header className="sticky top-0 z-30 border-b-2 border-grafite bg-[rgba(250,250,249,0.9)] backdrop-blur-md">
      <div className="relative mx-auto flex h-[64px] max-w-[1360px] items-center gap-4 px-4 sm:h-[76px] sm:px-8 xl:gap-12">
        <Link href="/" className="flex shrink-0 items-start text-grafite hover:text-grafite">
          <Marca className={TAMANHO_MARCA} />
          {SELO_DEMO && (
            <span title="Versão de demonstração" className="-mt-1 ml-1 rounded-full bg-violeta px-1.5 py-px font-mono text-[10px] leading-[1.4] tracking-[0.06em] text-white">
              DEMO
            </span>
          )}
        </Link>
        <nav aria-label="Principal" className="hidden min-w-0 flex-1 lg:block">
          <ul className="flex gap-[clamp(14px,2vw,28px)] whitespace-nowrap text-[15px] font-medium">
            {NAV.map((item) => (
              <li key={item.href}>
                <a href={item.href} className="flex items-center gap-1.5 transition-colors hover:text-violeta">
                  {item.ponto && <span aria-hidden className="h-2 w-2 rounded-full bg-violeta" />}
                  {item.rotulo}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-3 whitespace-nowrap text-[15px] font-medium">
          <Link href={ROTAS.entrar} className="hidden transition-colors hover:text-violeta sm:inline">Entrar</Link>
          <Link href={ROTAS.cadastro} className={`${BOTAO_ESCURO} px-4 py-2.5 text-[14px] shadow-[4px_4px_0_#5965F2] hover:shadow-[6px_6px_0_#5965F2] sm:px-[18px] sm:py-3 sm:text-[15px]`}>
            Começar grátis
          </Link>
          <MenuMovel />
        </div>
      </div>
    </header>
  )
}
