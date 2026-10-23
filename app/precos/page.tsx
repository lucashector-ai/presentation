import type { Metadata } from 'next'
import { Cabecalho } from '@/components/marketing/Cabecalho'
import { Precos } from '@/components/marketing/Precos'
import { Faq } from '@/components/marketing/Faq'
import { CtaFinal } from '@/components/marketing/CtaFinal'
import { Rodape } from '@/components/marketing/Rodape'
import { JsonLd } from '@/components/marketing/JsonLd'
import { FAQ_PRECOS } from '@/components/marketing/dados'
import { CONTEUDO } from '@/components/marketing/ui'
import { PLANOS } from '@/lib/planos'
import { jsonLdBreadcrumb, jsonLdFaq, jsonLdSoftware, jsonLdWebPage, metadadosPagina } from '@/lib/seo'

export const metadata: Metadata = metadadosPagina('/precos')

/** Página de preços: a mesma seção da landing (planos, calculadora, pacotes) com URL própria, FAQ de cobrança e ofertas em JSON-LD. */
export default function PaginaPrecos() {
  const f = PLANOS.free
  return (
    <div className="min-h-dvh overflow-x-clip bg-[#FAFAF9] text-grafite">
      <JsonLd nos={[jsonLdBreadcrumb([{ nome: 'Início', caminho: '/' }, { nome: 'Planos e preços', caminho: '/precos' }]), jsonLdWebPage('/precos'), jsonLdSoftware(), jsonLdFaq(FAQ_PRECOS)]} />
      <Cabecalho />
      <main>
        <header className={`${CONTEUDO} pt-12 sm:pt-[72px]`}>
          <nav aria-label="Você está em" className="font-mono text-[13px] uppercase tracking-[0.06em] text-[#737373]">
            <a href="/" className="hover:text-violeta">Início</a> <span aria-hidden>/</span> <span className="text-grafite">Planos e preços</span>
          </nav>
          <h1 className="mt-5 max-w-[900px] text-[clamp(44px,6vw,96px)] font-semibold leading-[0.92] tracking-[-0.055em] [text-wrap:balance]">Preços simples: 1 crédito, 1 tela.</h1>
          <p className="mt-7 max-w-[620px] text-[18px] leading-[1.5] text-[#3F3F3F] [text-wrap:pretty] sm:text-[20px]">
            Em reais, sem conversão de dólar. O Free vem com {f.creditos.quantidade} créditos e {f.limites.projetos} projetos para sempre; os planos pagos renovam créditos todo mês e os pacotes avulsos nunca expiram. Editar, apresentar e compartilhar não custam nada.
          </p>
        </header>
        <Precos />
        <Faq itens={FAQ_PRECOS} titulo="Sobre créditos e cobrança" />
        <CtaFinal />
      </main>
      <Rodape />
    </div>
  )
}
