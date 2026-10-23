'use client'
import { useEffect, useId, useRef, useState } from 'react'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'
import { NAV, ROTAS } from './dados'

/** Menu do cabeçalho abaixo de lg: botão que abre um painel com as âncoras e o "Entrar". */
export function MenuMovel() {
  const [aberto, setAberto] = useState(false)
  const id = useId()
  const botao = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!aberto) return
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setAberto(false); botao.current?.focus() }
    }
    const fecharSeLargo = () => { if (window.matchMedia('(min-width: 1024px)').matches) setAberto(false) }
    window.addEventListener('keydown', tecla)
    window.addEventListener('resize', fecharSeLargo)
    return () => { window.removeEventListener('keydown', tecla); window.removeEventListener('resize', fecharSeLargo) }
  }, [aberto])

  const fechar = () => setAberto(false)

  return (
    <div className="lg:hidden">
      <button
        ref={botao}
        type="button"
        aria-expanded={aberto}
        aria-controls={id}
        aria-label={aberto ? 'Fechar menu' : 'Abrir menu'}
        onClick={() => setAberto((v) => !v)}
        className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-tinta bg-superficie text-texto"
      >
        {aberto ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
      </button>
      <div id={id} hidden={!aberto} className="absolute inset-x-0 top-full border-b-2 border-tinta bg-fundo shadow-[0_12px_0_-6px_rgba(23,23,23,0.08)]">
        <nav aria-label="Menu" className="mx-auto max-w-[1360px] px-4 py-4 sm:px-8">
          <ul className="flex flex-col text-[20px] font-semibold tracking-[-0.02em]">
            {NAV.map((item) => (
              <li key={item.href} className="border-b border-bordaForte last:border-b-0">
                <a href={item.href} onClick={fechar} className="flex items-center gap-2 py-3.5 hover:text-violeta">
                  {item.ponto && <span aria-hidden className="h-2 w-2 rounded-full bg-violeta" />}
                  {item.rotulo}
                </a>
              </li>
            ))}
          </ul>
          <Link href={ROTAS.entrar} onClick={fechar} className="mt-3 flex h-12 items-center justify-center rounded-full border-2 border-tinta bg-superficie text-[16px] font-semibold">
            Entrar
          </Link>
        </nav>
      </div>
    </div>
  )
}
