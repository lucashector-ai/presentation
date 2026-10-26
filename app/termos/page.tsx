import type { Metadata } from 'next'
import { PaginaLegal, Lista, type SecaoLegal } from '@/components/marketing/PaginaLegal'
import { JsonLd } from '@/components/marketing/JsonLd'
import { EMPRESA, VERSAO_LEGAL } from '@/lib/legal'
import { ACUMULO_MAXIMO, PLANOS } from '@/lib/planos'
import { jsonLdBreadcrumb, jsonLdWebPage, metadadosPagina } from '@/lib/seo'

export const metadata: Metadata = metadadosPagina('/termos')

const E = EMPRESA
/** ", serviço de X, CNPJ Y, com sede em Z" — só o que estiver preenchido em lib/legal.ts. */
const OPERADOR = [E.razaoSocial && `, serviço de ${E.razaoSocial}`, E.cnpj && `, CNPJ ${E.cnpj}`, E.endereco && `, com sede em ${E.endereco}`].filter(Boolean).join('')
const F = PLANOS.free
const link = (href: string, texto: string) => <a href={href} className="text-violeta underline-offset-2 hover:underline">{texto}</a>

/**
 * Termos de uso: conta, planos e créditos (as regras de lib/planos.ts, as mesmas de /precos), conteúdo e IA,
 * links, uso aceitável, responsabilidade e foro. Os direitos do consumidor (CDC) prevalecem sobre qualquer item.
 */
const SECOES: SecaoLegal[] = [
  {
    id: 'aceite',
    titulo: 'Aceite',
    corpo: (
      <>
        <p>Estes termos regem o uso do {E.marca} ({E.site}){OPERADOR}. Ao criar uma conta ou usar o {E.marca}, você concorda com eles e com a {link('/privacidade', 'Política de privacidade')}.</p>
        <p>Se você usa o {E.marca} em nome de uma empresa, declara que pode aceitá-los por ela.</p>
      </>
    ),
  },
  {
    id: 'conta',
    titulo: 'Sua conta',
    corpo: (
      <Lista
        itens={[
          'Você precisa ter pelo menos 18 anos, ou de 13 a 17 com autorização dos responsáveis, e informar dados verdadeiros.',
          'Você é responsável por manter a senha em segredo e pelo que acontece na sua conta. Se perceber uso indevido, avise a gente.',
          'Em espaços de trabalho com equipe (plano Studio), o dono do espaço decide quem entra, com que papel, e é quem responde pelo plano e pelos créditos compartilhados.',
        ]}
      />
    ),
  },
  {
    id: 'servico',
    titulo: 'O serviço',
    corpo: (
      <p>O {E.marca} permite criar apresentações com IA e num editor visual, apresentar e enviar por link. Podemos melhorar, mudar ou retirar recursos; quando uma mudança tirar algo importante de um plano pago, avisaremos com antecedência.</p>
    ),
  },
  {
    id: 'planos',
    titulo: 'Planos, créditos e pagamento',
    corpo: (
      <>
        <p>Os planos, preços e limites em vigor estão em {link('/precos', 'Planos e preços')}. O Free vem com {F.creditos.quantidade} créditos e {F.limites.projetos} projetos, sem cartão.</p>
        <Lista
          itens={[
            <><strong>Créditos.</strong> 1 crédito = 1 tela criada ou refeita pela IA. Editar, apresentar, compartilhar, trocar estilo, cores, fontes e logo não usam créditos. O custo aparece antes de cada geração.</>,
            <><strong>Créditos mensais</strong> dos planos pagos renovam a cada ciclo; o que sobrar acumula até {ACUMULO_MAXIMO}× a cota mensal. <strong>Pacotes avulsos</strong> não expiram.</>,
            'Se uma geração falhar por erro nosso ou do provedor de IA, os créditos voltam automaticamente para o saldo.',
            'Créditos não são dinheiro: não podem ser sacados, vendidos ou transferidos para outra conta (no Studio, são compartilhados dentro do espaço de trabalho).',
            <><strong>Renovação.</strong> Planos pagos renovam automaticamente no fim de cada período (mensal ou anual) até você cancelar.</>,
            <><strong>Cancelamento.</strong> Você cancela quando quiser; o plano vale até o fim do período já pago e depois a conta volta aos limites do Free. Nada é apagado.</>,
            <><strong>Arrependimento.</strong> Na primeira contratação de um plano ou pacote, você pode desistir em até 7 dias e receber o valor de volta (art. 49 do Código de Defesa do Consumidor).</>,
            'Mudanças de preço valem só a partir do ciclo seguinte e são avisadas com pelo menos 30 dias de antecedência.',
            'Os pagamentos são processados por um provedor de pagamento parceiro, com as condições dele para o meio escolhido (cartão, Pix ou boleto).',
          ]}
        />
      </>
    ),
  },
  {
    id: 'conteudo',
    titulo: 'Seu conteúdo',
    corpo: (
      <>
        <p><strong>O que você cria e envia é seu.</strong> Você nos dá apenas a licença necessária para guardar, processar, exibir para você e para quem você compartilhar, e enviar aos provedores que fazem o serviço funcionar (incluindo a IA, quando você usa esses recursos). Essa licença termina quando você apaga o conteúdo ou a conta, salvo cópias que a lei exija manter.</p>
        <p>Não usamos o seu conteúdo para treinar modelos de IA.</p>
        <p>Você garante que tem os direitos sobre o que envia: logos e marcas de clientes, fotos, fontes, textos, dados e manuais de marca. Se recebermos uma notificação fundamentada de violação, podemos retirar o conteúdo do ar e avisaremos você.</p>
      </>
    ),
  },
  {
    id: 'ia',
    titulo: 'Conteúdo gerado por IA',
    corpo: (
      <>
        <p>Roteiros, textos e telas gerados pela IA podem conter erros, números imprecisos ou semelhanças com materiais existentes. <strong>Revise antes de apresentar</strong>, principalmente dados, nomes e afirmações sobre terceiros.</p>
        <p>Na medida permitida pela lei, o resultado gerado a partir do seu pedido é seu para usar como quiser, inclusive comercialmente. Você é responsável pelo uso que faz dele. Resultados parecidos podem ser gerados para outras pessoas.</p>
        <p>As regras automáticas (por exemplo, trocar as cores do logo para seguir a identidade) existem para ajudar; confira se o resultado respeita o manual da marca.</p>
      </>
    ),
  },
  {
    id: 'links',
    titulo: 'Links de apresentação',
    corpo: (
      <p>Quem tem um link publicado vê a versão publicada da apresentação. Você decide se o link tem senha (nos planos que oferecem) e validade, e pode revogá-lo a qualquer momento. Você é responsável por com quem compartilha o link e pelo que a apresentação mostra.</p>
    ),
  },
  {
    id: 'uso',
    titulo: 'Uso aceitável',
    corpo: (
      <>
        <p>Não é permitido usar o {E.marca} para:</p>
        <Lista
          itens={[
            'conteúdo ilegal, de abuso ou exploração sexual de menores, discurso de ódio, assédio, ameaças ou incentivo à violência;',
            'golpes, phishing, imitação de pessoas ou empresas, ou apresentações enganosas sobre produtos financeiros e de saúde;',
            'violar direitos autorais, de marca, de imagem ou a privacidade de outras pessoas;',
            'enviar vírus ou código malicioso, tentar acessar contas ou dados de outros, ou testar a segurança sem autorização;',
            'burlar limites de plano e créditos, criar contas em massa, revender o acesso ou extrair dados de forma automatizada;',
            'sobrecarregar o serviço ou usá-lo para gerar conteúdo em massa para treinar outros modelos de IA.',
          ]}
        />
        <p>Também valem as políticas de uso do provedor de IA para o conteúdo que você pede.</p>
      </>
    ),
  },
  {
    id: 'propriedade',
    titulo: 'Propriedade do Mostra',
    corpo: (
      <p>O software, a marca {E.marca}, os estilos, modelos, blocos e mockups são nossos ou licenciados para nós. Você pode usá-los livremente dentro das apresentações que cria, mas não pode copiá-los para oferecer um serviço concorrente nem fazer engenharia reversa do {E.marca}. Ferramentas de terceiros citadas (como Figma, Illustrator, Google Fonts) pertencem aos seus donos.</p>
    ),
  },
  {
    id: 'disponibilidade',
    titulo: 'Disponibilidade e backups',
    corpo: (
      <p>Trabalhamos para manter o {E.marca} no ar o tempo todo, mas podem acontecer manutenções e falhas de terceiros (hospedagem, banco de dados, IA). Guardamos seus projetos com histórico de revisões, mas recomendamos manter cópias do que for crítico (exportação em PDF e PNG).</p>
    ),
  },
  {
    id: 'suspensao',
    titulo: 'Suspensão e encerramento',
    corpo: (
      <p>Você pode encerrar a conta quando quiser. Podemos suspender ou encerrar contas que violem estes termos, coloquem outras pessoas em risco ou deixem de pagar, avisando antes sempre que possível e dando a chance de baixar o conteúdo, exceto em casos graves ou quando a lei impedir.</p>
    ),
  },
  {
    id: 'responsabilidade',
    titulo: 'Responsabilidade',
    corpo: (
      <>
        <p>Respondemos pelos danos que causarmos, nos termos da lei. Não respondemos por conteúdo enviado ou gerado a seu pedido, pelo uso que você faz das apresentações, por decisões tomadas com base nelas, nem por falhas de serviços de terceiros que fogem ao nosso controle.</p>
        <p>Nada nestes termos limita os direitos garantidos pelo Código de Defesa do Consumidor a quem usa o {E.marca} como consumidor.</p>
      </>
    ),
  },
  {
    id: 'mudancas',
    titulo: 'Mudanças nestes termos',
    corpo: <p>Podemos atualizar estes termos. A data no topo indica a versão em vigor; mudanças relevantes serão avisadas por e-mail ou dentro do produto com antecedência. Continuar usando o {E.marca} depois disso significa concordar com a nova versão; se não concordar, você pode cancelar.</p>,
  },
  {
    id: 'lei',
    titulo: 'Lei e foro',
    corpo: <p>Valem as leis do Brasil. Para consumidores, o foro é o do seu domicílio; nos demais casos, o foro de {E.foro}. Antes de qualquer disputa, fale com a gente: a maioria das questões se resolve rápido.</p>,
  },
  {
    id: 'contato',
    titulo: 'Contato',
    corpo: <p>Fale com a gente por {link(`mailto:${E.emailContato}`, E.emailContato)}{(E.emailPrivacidade as string) !== E.emailContato && <> · privacidade: {link(`mailto:${E.emailPrivacidade}`, E.emailPrivacidade)}</>}.</p>,
  },
]

export default function PaginaTermos() {
  return (
    <>
      <JsonLd nos={[jsonLdBreadcrumb([{ nome: 'Início', caminho: '/' }, { nome: 'Termos de uso', caminho: '/termos' }]), jsonLdWebPage('/termos')]} />
      <PaginaLegal
        titulo="Termos de uso"
        atualizacao={VERSAO_LEGAL.termos}
        resumo={<p>Em resumo: o que você cria é seu; 1 crédito = 1 tela feita pela IA, com o custo sempre à vista; você cancela quando quiser e pode desistir em até 7 dias da primeira compra; revise o que a IA gerar antes de apresentar; e não use o {E.marca} para nada ilegal ou enganoso.</p>}
        secoes={SECOES}
      />
    </>
  )
}
