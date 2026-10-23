import type { Metadata } from 'next'
import Link from 'next/link'
import { Cabecalho } from '@/components/marketing/Cabecalho'
import { Concorrentes } from '@/components/marketing/Concorrentes'
import { Faq } from '@/components/marketing/Faq'
import { CtaFinal } from '@/components/marketing/CtaFinal'
import { Rodape } from '@/components/marketing/Rodape'
import { JsonLd } from '@/components/marketing/JsonLd'
import { FAQ, ROTAS } from '@/components/marketing/dados'
import { BOTAO_CLARO, BOTAO_ESCURO, CONTEUDO, Forma, Rotulo, TituloSecao } from '@/components/marketing/ui'
import { PLANOS, ROTEIROS_GRATIS, custoApresentacao } from '@/lib/planos'
import { MAX_TELAS_IA, MIN_TELAS_IA, textoTelas } from '@/lib/telasIa'
import { absoluta, jsonLdBreadcrumb, jsonLdFaq, jsonLdWebPage, metadadosPagina } from '@/lib/seo'

export const metadata: Metadata = metadadosPagina('/apresentacao-com-ia')

/** Passo a passo factual (vira HowTo no JSON-LD). */
const PASSOS_IA = [
  { titulo: 'Descreva o briefing', texto: 'Escreva o que a apresentação precisa dizer, para quem e em que tom — ou cole um texto, um briefing, um PDF ou um .docx. Números e o que não pode faltar entram como material.', cor: '#E4572E', forma: 'circulo' },
  { titulo: 'Escolha a marca e o estilo', texto: 'Envie o logo e a IA extrai a paleta; ou escolha uma paleta pronta e um par de fontes. Depois, um estilo de composição com prévia real. Tudo isso é grátis e fica salvo como kit de marca.', cor: '#5965F2', forma: 'quadrado' },
  { titulo: 'Revise o roteiro', texto: `A IA escreve o roteiro tela por tela (de ${MIN_TELAS_IA} a ${MAX_TELAS_IA} telas). Edite, reordene, peça outro — até ${ROTEIROS_GRATIS} roteiros por apresentação, sem gastar créditos.`, cor: '#D7F25C', forma: 'triangulo' },
  { titulo: 'Gere as telas e envie o link', texto: `Cada tela é desenhada no seu kit de marca, em auto layout, editável no canvas. Custa 1 crédito por tela (10 telas = ${custoApresentacao(10)}). Publique e mande um link privado; o cliente abre sem criar conta.`, cor: '#F2C14E', forma: 'semicirculo' },
] as const

/** Perguntas desta página: as que falam de IA, custo, Gamma e exportação. */
const FAQ_IA = FAQ.filter((q) => /IA|custa|Gamma|PDF|Figma/.test(q.pergunta))

const PUBLICOS = [
  { quem: 'Designers e diretores de arte', para: 'identidades visuais, key visuals e portfólios que precisam de movimento e precisão de layout.' },
  { quem: 'Agências e estúdios', para: 'propostas e campanhas na marca do cliente, com a equipe editando junto e o link acompanhado.' },
  { quem: 'Vendas e consultorias', para: 'propostas comerciais e relatórios de resultados com números, gráficos e link com senha.' },
  { quem: 'Founders', para: 'pitch para investidores: roteiro em minutos, telas na identidade da empresa, atualização no mesmo link.' },
]

export default function PaginaApresentacaoComIA() {
  const howTo = {
    '@type': 'HowTo',
    name: 'Como fazer uma apresentação com IA no Mostra',
    description: 'Do briefing ao link enviado em quatro passos, em português e na sua marca.',
    inLanguage: 'pt-BR',
    totalTime: 'PT10M',
    step: PASSOS_IA.map((p, i) => ({ '@type': 'HowToStep', position: i + 1, name: p.titulo, text: p.texto, url: `${absoluta('/apresentacao-com-ia')}#passo-${i + 1}` })),
  }
  return (
    <div className="min-h-dvh overflow-x-clip bg-[#FAFAF9] text-grafite">
      <JsonLd nos={[jsonLdBreadcrumb([{ nome: 'Início', caminho: '/' }, { nome: 'Apresentação com IA', caminho: '/apresentacao-com-ia' }]), jsonLdWebPage('/apresentacao-com-ia'), howTo, jsonLdFaq(FAQ_IA)]} />
      <Cabecalho />
      <main>
        <header className={`${CONTEUDO} pb-16 pt-12 sm:pb-24 sm:pt-[72px]`}>
          <nav aria-label="Você está em" className="font-mono text-[13px] uppercase tracking-[0.06em] text-[#737373]">
            <a href="/" className="hover:text-violeta">Início</a> <span aria-hidden>/</span> <span className="text-grafite">Apresentação com IA</span>
          </nav>
          <h1 className="mt-5 max-w-[1000px] text-[clamp(44px,6vw,96px)] font-semibold leading-[0.92] tracking-[-0.055em] [text-wrap:balance]">
            Como fazer uma apresentação com IA — em português, na sua marca.
          </h1>
          <p className="mt-7 max-w-[680px] text-[18px] leading-[1.5] text-[#3F3F3F] [text-wrap:pretty] sm:text-[20px]">
            No Mostra, a IA escreve o roteiro a partir do seu briefing e desenha cada tela no seu kit de marca. O resultado não é um PDF nem um bloco fechado: são camadas editáveis num canvas livre, com animações, interações e um link privado para o cliente. Grátis para começar, com {PLANOS.free.creditos.quantidade} créditos ({textoTelas(PLANOS.free.creditos.quantidade)}).
          </p>
          <div className="mt-9 flex flex-wrap gap-4">
            <Link href={ROTAS.cadastro} className={`${BOTAO_ESCURO} px-[26px] py-[17px] text-[16px] shadow-[5px_5px_0_#E4572E] hover:shadow-[7px_7px_0_#E4572E]`}>Criar minha apresentação</Link>
            <Link href="/precos" className={`${BOTAO_CLARO} px-[26px] py-[17px] text-[16px]`}>Ver planos e créditos <span aria-hidden>→</span></Link>
          </div>
        </header>

        <section aria-labelledby="titulo-passos" className="border-y-2 border-grafite bg-creme">
          <div className={`${CONTEUDO} py-20 sm:py-[110px]`}>
            <Rotulo>Passo a passo</Rotulo>
            <div id="titulo-passos"><TituloSecao className="mb-12 mt-4 max-w-[860px]">Do briefing ao link em quatro passos.</TituloSecao></div>
            <ol className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-5 p-0">
              {PASSOS_IA.map((p, i) => (
                <li key={p.titulo} id={`passo-${i + 1}`} className="flex flex-col gap-4 rounded-2xl border-2 border-grafite bg-white p-6 sm:p-7">
                  <div className="flex items-center gap-3">
                    <Forma tipo={p.forma} cor={p.cor} className={p.forma === 'semicirculo' ? 'h-4 w-8' : 'h-8 w-8'} />
                    <span className="font-mono text-[13px] text-[#737373]">0{i + 1}</span>
                  </div>
                  <h3 className="m-0 text-[24px] font-semibold leading-[1.1] tracking-[-0.03em]">{p.titulo}</h3>
                  <p className="m-0 text-[16px] leading-[1.55] text-[#3F3F3F]">{p.texto}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section aria-labelledby="titulo-publicos" className={`${CONTEUDO} py-20 sm:py-[110px]`}>
          <Rotulo>Para quem</Rotulo>
          <div id="titulo-publicos"><TituloSecao className="mb-10 mt-4 max-w-[860px]">Quem apresenta para cliente, e não para plateia.</TituloSecao></div>
          <dl className="m-0 grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-x-10 gap-y-8">
            {PUBLICOS.map((p) => (
              <div key={p.quem} className="border-t-2 border-grafite pt-5">
                <dt className="text-[20px] font-semibold tracking-[-0.02em]">{p.quem}</dt>
                <dd className="m-0 mt-2 text-[16px] leading-[1.55] text-[#3F3F3F]">{p.para}</dd>
              </div>
            ))}
          </dl>
        </section>

        <div className="border-t-2 border-grafite bg-[#F4F1EC]">
          <Concorrentes id="gamma" titulo="Mostra como alternativa ao Gamma, ao Pitch e ao Canva." />
        </div>

        <Faq itens={FAQ_IA} titulo="Perguntas sobre apresentações com IA" />
        <CtaFinal />
      </main>
      <Rodape />
    </div>
  )
}
