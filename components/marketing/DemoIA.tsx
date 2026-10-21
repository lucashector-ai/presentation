'use client'
import { useState } from 'react'
import Link from 'next/link'
import { IA_ETAPAS, IA_EXEMPLOS, IA_FORMATOS, IA_PROMPT_INICIAL, IA_TELAS, IA_TEMAS, ROTAS } from './dados'
import { Forma } from './ui'

/** Formas que se alternam nas telas da prévia (raio + clip-path). */
const FORMAS_TELA: { raio: string; clip: string | undefined }[] = [
  { raio: '50%', clip: undefined },
  { raio: '6px', clip: undefined },
  { raio: '0', clip: 'polygon(50% 0,100% 100%,0 100%)' },
  { raio: '999px 999px 0 0', clip: undefined },
]

/**
 * Demonstração do "Criar com IA": formato, prompt, exemplos e tema são interativos; "Gerar" leva
 * para /criar com o prompt preenchido (a geração de verdade acontece lá, com créditos).
 */
export function DemoIA() {
  const [formato, setFormato] = useState(0)
  const [prompt, setPrompt] = useState(IA_PROMPT_INICIAL)
  const [tema, setTema] = useState(0)
  const t = IA_TEMAS[tema] ?? IA_TEMAS[0]
  const hrefGerar = `${ROTAS.criar}?${new URLSearchParams({ prompt, formato: (IA_FORMATOS[formato] ?? IA_FORMATOS[0]).toLowerCase() }).toString()}`

  return (
    <div className="relative grid grid-cols-[repeat(auto-fit,minmax(min(100%,460px),1fr))] items-start gap-7">
      <div className="flex min-w-0 flex-col gap-4">
        <div className="overflow-hidden rounded-[18px] border-2 border-[#FAFAF9] bg-[#FAFAF9] text-grafite shadow-[8px_8px_0_#5965F2]">
          <div role="group" aria-label="Formato" className="flex gap-1.5 px-[18px] pt-3.5 text-[12px]">
            {IA_FORMATOS.map((f, i) => (
              <button
                key={f}
                type="button"
                aria-pressed={formato === i}
                onClick={() => setFormato(i)}
                className={`rounded-full border-[1.5px] border-grafite px-3 py-[5px] transition-colors ${formato === i ? 'bg-grafite text-[#FAFAF9]' : 'bg-white text-grafite hover:bg-[#F3F2F0]'}`}
              >
                {f}
              </button>
            ))}
          </div>
          <textarea
            aria-label="Descreva sua apresentação"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
            placeholder="Ex.: Identidade visual para uma marca de cerâmica artesanal…"
            className="block w-full resize-none border-0 bg-transparent px-[18px] pb-2 pt-4 text-[17px] leading-[1.5] text-grafite outline-none placeholder:text-[#A3A3A3] focus-visible:outline-none sm:text-[18px]"
          />
          <div className="flex items-center gap-2.5 px-3.5 pb-3.5 pt-2.5">
            <span className="text-[12px] text-[#737373]">6 telas · tom editorial</span>
            <Link
              href={hrefGerar}
              className="ml-auto flex h-11 items-center gap-2.5 rounded-full border-2 border-grafite bg-violeta px-5 text-[15px] font-semibold text-white transition-colors hover:bg-[#4A55E0] hover:text-white"
            >
              Gerar <span aria-hidden>✦</span>
            </Link>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {IA_EXEMPLOS.map((ex) => (
            <button
              key={ex.rotulo}
              type="button"
              onClick={() => setPrompt(ex.prompt)}
              aria-pressed={prompt === ex.prompt}
              className="flex items-center gap-2 rounded-full border-[1.5px] border-[#525252] bg-transparent px-3.5 py-2 text-[13px] text-[#FAFAF9] transition-colors hover:border-[#FAFAF9] aria-pressed:border-[#FAFAF9]"
            >
              <Forma tipo={ex.forma} cor={ex.cor} className={ex.forma === 'semicirculo' ? 'h-[5px] w-[10px]' : 'h-2.5 w-2.5'} />
              {ex.rotulo}
            </button>
          ))}
        </div>

        <ol className="m-0 mt-3 grid list-none gap-3 p-0 sm:grid-cols-3">
          {IA_ETAPAS.map((e) => (
            <li key={e.titulo} className="border-t-2 border-[#FAFAF9] pt-3">
              <div className="text-[15px] font-semibold">{e.titulo}</div>
              <div className="mt-1 text-[13px] leading-[1.45] text-[#A3A3A3]">{e.texto}</div>
            </li>
          ))}
        </ol>
      </div>

      <div className="flex min-w-0 flex-col gap-3.5">
        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-[12px] text-[#A3A3A3]" aria-live="polite">PRONTO · 6 TELAS · TEMA {t.nome.toUpperCase()}</span>
          <div role="group" aria-label="Tema" className="flex gap-1.5">
            {IA_TEMAS.map((th, i) => (
              <button
                key={th.nome}
                type="button"
                title={th.nome}
                aria-label={`Tema ${th.nome}`}
                aria-pressed={tema === i}
                onClick={() => setTema(i)}
                className="h-[26px] w-[26px] rounded-full border-2 p-0"
                style={{ background: th.fundo, borderColor: tema === i ? '#FAFAF9' : '#404040' }}
              />
            ))}
          </div>
        </div>
        <ul aria-label="Telas geradas" className="m-0 grid list-none grid-cols-2 gap-3 p-0">
          {IA_TELAS.map((titulo, i) => {
            const alt = i % 3 === 2
            const forma = FORMAS_TELA[(i + tema) % FORMAS_TELA.length] ?? { raio: '50%', clip: undefined }
            const grande = i === 0
            const fg = alt ? t.tintaAlt : t.tinta
            return (
              <li
                key={titulo}
                className="relative aspect-[16/10] overflow-hidden rounded-[10px] border-2 border-[#FAFAF9] transition-colors duration-300 [container-type:inline-size] motion-reduce:transition-none"
                style={{ background: alt ? t.fundoAlt : t.fundo }}
              >
                <span aria-hidden className="absolute right-[8%] top-[12%] aspect-square" style={{ width: grande ? '34%' : '26%', borderRadius: forma.raio, clipPath: forma.clip, background: alt ? t.fundo : t.acento }} />
                <span aria-hidden className="absolute left-[7%] top-[9%] font-mono opacity-70" style={{ fontSize: '4cqw', color: fg }}>{String(i + 1).padStart(2, '0')}</span>
                <span className="absolute bottom-[9%] left-[7%] right-[38%] font-semibold leading-[0.98] tracking-[-0.045em] [text-wrap:balance]" style={{ fontSize: grande ? '13cqw' : '9cqw', color: fg }}>{titulo}</span>
              </li>
            )
          })}
        </ul>
        <Link
          href={ROTAS.criar}
          className="mt-1.5 self-start rounded-full border-2 border-grafite bg-lima px-6 py-[15px] text-[15px] font-semibold text-grafite shadow-[5px_5px_0_#FAFAF9] transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 hover:text-grafite motion-reduce:transition-none motion-reduce:hover:translate-x-0 motion-reduce:hover:translate-y-0"
        >
          Criar minha apresentação com IA <span aria-hidden>→</span>
        </Link>
      </div>
    </div>
  )
}
