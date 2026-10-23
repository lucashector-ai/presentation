import type { Metadata } from 'next'
import { Cabecalho } from '@/components/marketing/Cabecalho'
import { Hero } from '@/components/marketing/Hero'
import { Faixa } from '@/components/marketing/Faixa'
import { ComoFunciona } from '@/components/marketing/ComoFunciona'
import { CriarComIA } from '@/components/marketing/CriarComIA'
import { Formatos } from '@/components/marketing/Formatos'
import { Recursos } from '@/components/marketing/Recursos'
import { Comparacao } from '@/components/marketing/Comparacao'
import { Concorrentes } from '@/components/marketing/Concorrentes'
import { Precos } from '@/components/marketing/Precos'
import { Faq } from '@/components/marketing/Faq'
import { CtaFinal } from '@/components/marketing/CtaFinal'
import { Rodape } from '@/components/marketing/Rodape'
import { JsonLd } from '@/components/marketing/JsonLd'
import { FAQ } from '@/components/marketing/dados'
import { jsonLdFaq, jsonLdOrganizacao, jsonLdSoftware, jsonLdWebPage, jsonLdWebSite, metadadosPagina } from '@/lib/seo'

export const metadata: Metadata = metadadosPagina('/')

/** Landing da Mostra (Claude Design, "Landing v2"). Sempre no tema claro, como no design. */
export default function Marketing() {
  return (
    <div className="min-h-dvh overflow-x-clip bg-[#FAFAF9] text-grafite">
      <JsonLd nos={[jsonLdOrganizacao(), jsonLdWebSite(), jsonLdSoftware(), jsonLdWebPage('/'), jsonLdFaq(FAQ)]} />
      <a href="#conteudo" className="sr-only rounded-full bg-grafite px-4 py-2 text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50">
        Pular para o conteúdo
      </a>
      <Cabecalho />
      <main id="conteudo">
        <Hero />
        <Faixa />
        <ComoFunciona />
        <CriarComIA />
        <Formatos />
        <Recursos />
        <Comparacao />
        <Concorrentes />
        <Precos />
        <Faq />
        <CtaFinal />
      </main>
      <Rodape />
    </div>
  )
}
