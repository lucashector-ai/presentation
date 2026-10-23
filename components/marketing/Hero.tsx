import Link from 'next/link'
import { ROTAS } from './dados'
import { BOTAO_CLARO, BOTAO_ESCURO, CONTEUDO, TRIANGULO, hachura, pontos } from './ui'

export function Hero() {
  return (
    <>
      <section className={`${CONTEUDO} grid items-center gap-10 pb-10 pt-12 sm:pt-[88px] lg:grid-cols-2`}>
        <div className="relative min-w-0">
          <p className="m-0 inline-flex items-center gap-2.5 rounded-full border-2 border-tinta bg-superficie py-[7px] pl-2 pr-3.5 text-[13px] font-medium">
            <span className="rounded-full border-2 border-tinta bg-lima px-[9px] py-0.5 font-mono text-[11px] leading-[1.3] text-grafite">NOVO</span>
            Editor de interações sem código
          </p>
          <h1 className="mt-8 text-[clamp(52px,6.6vw,112px)] font-semibold leading-[0.92] tracking-[-0.055em] [text-wrap:balance]">
            Seus projetos merecem mais do que um{' '}
            <span className="inline-block -rotate-2 rounded-[0.12em] bg-violeta px-[0.14em] text-[#FAFAF9]">PDF.</span>
          </h1>
          {/* frase-definição citável (buscadores e IAs): a mesma de lib/seo.ts › DEFINICAO, na voz da landing */}
          <p className="mt-9 max-w-[520px] text-[18px] leading-[1.5] text-textoCorpo [text-wrap:pretty] sm:text-[20px]">
            Mostra é a plataforma brasileira para criar apresentações com IA e um editor de nível profissional — com movimento, interações, 3D e links privados, sem escrever código.
          </p>
          {/* calha de 16: a sombra carimbo do botão escuro (5 px, 7 no hover) não encosta no botão claro ao lado */}
          <div className="mt-9 flex flex-wrap gap-4">
            <Link href={ROTAS.cadastro} className={`${BOTAO_ESCURO} px-[26px] py-[17px] text-[16px] shadow-[5px_5px_0_#E4572E] hover:shadow-[7px_7px_0_#E4572E]`}>
              Começar gratuitamente
            </Link>
            <Link href={ROTAS.exemplo} className={`${BOTAO_CLARO} px-[26px] py-[17px] text-[16px]`}>
              Explorar a plataforma <span aria-hidden>→</span>
            </Link>
          </div>
        </div>

        <div aria-hidden className="relative aspect-square w-full max-w-[420px] justify-self-center sm:max-w-[560px]">
          <div className="absolute left-[8%] top-[6%] aspect-square w-[52%] rounded-full border-2 border-tinta bg-coral" />
          <div className="absolute right-[4%] top-[2%] aspect-square w-[30%] rotate-[16deg] border-2 border-tinta bg-violeta" />
          <div className={`absolute right-[6%] top-[38%] aspect-square w-[44%] -rotate-[10deg] bg-lima ${TRIANGULO}`} />
          <div className="absolute bottom-[8%] left-[2%] aspect-[2/1] w-[46%] rounded-t-full border-2 border-b-0 border-tinta bg-ipe" />
          <div className="absolute bottom-[4%] left-[44%] aspect-square w-[30%] border-2 border-tinta bg-mare" />
          <div className="absolute left-0 top-[52%] h-[18%] w-[28%]" style={pontos('rgb(var(--cor-tinta))', 2.5, 16)} />
          <div className="absolute bottom-[6%] right-0 h-[8%] w-[22%]" style={hachura()} />
          <div className="absolute left-[26%] top-[28%] aspect-square w-[12%] rounded-full border-2 border-tinta bg-fundo" />
        </div>
      </section>

      <section aria-label="Prévia do editor" className={`${CONTEUDO} pb-20 pt-10 sm:pb-[120px]`}>
        <div aria-hidden className="absolute left-0 top-0 h-[120px] w-[120px] rounded-full bg-ipe sm:h-[180px] sm:w-[180px]" />
        <div aria-hidden className="absolute bottom-[60px] right-0 hidden h-[200px] w-[200px] rotate-12 bg-mare sm:block" />
        <div aria-hidden className="absolute bottom-10 left-[8%] h-[140px] w-[140px] bg-coral [clip-path:polygon(0_0,100%_100%,0_100%)]" />
        <EditorMock />
      </section>
    </>
  )
}

function EditorMock() {
  return (
    <div
      role="img"
      aria-label="Editor da Mostra: projeto Festival Ruído com quatro telas, a tela de capa aberta no canvas e o painel de interações configurando um clique que navega para a tela 02 com animação morph."
      className="relative overflow-hidden rounded-2xl border-2 border-tinta bg-superficie shadow-carimbo-lg sm:shadow-[12px_12px_0_rgb(var(--cor-tinta))]"
    >
      <div className="flex h-[52px] items-center gap-3.5 border-b-2 border-tinta px-4 text-[13px]">
        <span className="flex shrink-0 gap-1.5">
          <span className="h-3 w-3 rounded-full border-[1.5px] border-tinta bg-coral" />
          <span className="h-3 w-3 rounded-full border-[1.5px] border-tinta bg-ipe" />
          <span className="h-3 w-3 rounded-full border-[1.5px] border-tinta bg-lima" />
        </span>
        <span className="truncate font-semibold">Festival Ruído — Key visual</span>
        <span className="hidden items-center gap-1.5 text-texto2 sm:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-sucesso" />Salvo
        </span>
        <span className="ml-auto flex shrink-0 gap-2 font-medium">
          <span className="hidden rounded-full border-2 border-tinta px-3 py-1.5 sm:inline">Apresentar</span>
          <span className="rounded-full border-2 border-tinta bg-violeta px-3 py-1.5 text-white">Compartilhar</span>
        </span>
      </div>
      <div className="grid md:grid-cols-[minmax(0,180px)_minmax(0,1fr)] lg:grid-cols-[minmax(0,180px)_minmax(0,1fr)_minmax(0,240px)]">
        <div className="hidden flex-col gap-2.5 border-r-2 border-tinta bg-fundo p-3.5 md:flex">
          <div className="font-mono text-[10px] text-texto2">TELAS · 04</div>
          <div className="relative aspect-video overflow-hidden rounded bg-coral outline outline-2 outline-offset-2 outline-violeta">
            <span className="absolute right-[10%] top-[15%] aspect-square w-[24%] rounded-full bg-ipe" />
            <span className="absolute bottom-[10%] left-[8%] text-[13px] font-bold tracking-[-0.04em] text-[#FFF4EC]">RUÍDO</span>
          </div>
          <div className="relative aspect-video overflow-hidden rounded bg-mare">
            <span className={`absolute left-[30%] top-[20%] h-[60%] w-[40%] bg-lima ${TRIANGULO}`} />
          </div>
          <div className="aspect-video rounded bg-ipe" style={pontos('#2A2118', 1.5, 8)} />
          <div className="relative aspect-video overflow-hidden rounded bg-ameixa">
            <span className="absolute bottom-0 left-[20%] h-[50%] w-[60%] rounded-t-full bg-pessego" />
          </div>
        </div>

        <div className="flex items-center justify-center bg-canvas p-[clamp(14px,4vw,52px)]">
          <div className="relative aspect-video w-full max-w-[840px] overflow-hidden border-2 border-tinta bg-coral [container-type:inline-size]">
            <div className="absolute left-[5%] top-[7%] font-mono tracking-[0.06em] text-[#FFF4EC]" style={{ fontSize: '1.4cqw' }}>FESTIVAL RUÍDO · 2026 · SÃO PAULO</div>
            <div className="absolute bottom-[6%] left-[4.4%] font-bold leading-[0.85] tracking-[-0.06em] text-[#FFF4EC]" style={{ fontSize: '17cqw' }}>RUÍDO</div>
            <div className="absolute right-[6%] top-[10%] aspect-square w-[26%] rounded-full bg-ipe outline outline-2 outline-offset-4 outline-violeta" />
            <div className={`absolute right-[28%] top-[38%] aspect-square w-[16%] bg-mare ${TRIANGULO}`} />
            <div className="absolute bottom-[10%] right-[5%] h-[12%] w-[20%]" style={hachura('0.5cqw', '1.4cqw')} />
            <div className="absolute left-[52%] top-[12%] aspect-square w-[9%] rotate-[20deg] bg-lima" />
            <div
              className="absolute whitespace-nowrap rounded-full bg-violeta font-mono text-white"
              style={{ right: 'calc(6% + 13% - 4cqw)', top: 'calc(10% + 26cqw)', fontSize: '1.2cqw', padding: '0.4cqw 1cqw' }}
            >
              Clique → Tela 02 · Morph
            </div>
          </div>
        </div>

        <div className="hidden flex-col gap-4 border-l-2 border-tinta bg-fundo p-4 text-[12px] lg:flex">
          <div className="flex gap-1.5">
            <span className="rounded-full border-[1.5px] border-tinta px-2.5 py-[5px]">Design</span>
            <span className="rounded-full border-[1.5px] border-tinta px-2.5 py-[5px]">Animação</span>
            <span className="rounded-full border-[1.5px] border-tinta bg-acao px-2.5 py-[5px] text-acaoTexto">Interações</span>
          </div>
          <div>
            <div className="mb-2 text-texto2">Gatilho</div>
            <div className="grid grid-cols-2 gap-1.5">
              <span className="rounded-lg border-[1.5px] border-violeta bg-acentoSuave p-2 text-center text-violeta">Clique</span>
              <span className="rounded-lg border-[1.5px] border-bordaForte p-2 text-center">Hover</span>
            </div>
          </div>
          <div>
            <div className="mb-2 text-texto2">Ação</div>
            <div className="rounded-lg border-[1.5px] border-bordaForte bg-superficie px-2.5 py-[9px]">Navegar para tela 02</div>
          </div>
          <div>
            <div className="mb-2 text-texto2">Animação</div>
            <div className="grid grid-cols-4 gap-1">
              {['Fade', 'Slide', 'Scale'].map((a) => (
                <span key={a} className="rounded-md border-[1.5px] border-bordaForte py-[7px] text-center">{a}</span>
              ))}
              <span className="rounded-md border-[1.5px] border-violeta bg-acentoSuave py-[7px] text-center text-violeta">Morph</span>
            </div>
          </div>
          <div>
            <div className="mb-2 text-texto2">Duração · 600ms</div>
            <div className="h-1 rounded-sm bg-bordaForte"><div className="h-1 w-[45%] rounded-sm bg-violeta" /></div>
          </div>
        </div>
      </div>
    </div>
  )
}
