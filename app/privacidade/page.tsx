import type { Metadata } from 'next'
import { PaginaLegal, Lista, type SecaoLegal } from '@/components/marketing/PaginaLegal'
import { JsonLd } from '@/components/marketing/JsonLd'
import { EMPRESA, VERSAO_LEGAL } from '@/lib/legal'
import { jsonLdBreadcrumb, jsonLdWebPage, metadadosPagina } from '@/lib/seo'

export const metadata: Metadata = metadadosPagina('/privacidade')

const E = EMPRESA
/** ", operado por X, CNPJ Y, com sede em Z" — só o que estiver preenchido em lib/legal.ts. */
const OPERADOR = [E.razaoSocial && `, operado por ${E.razaoSocial}`, E.cnpj && `, CNPJ ${E.cnpj}`, E.endereco && `, com sede em ${E.endereco}`].filter(Boolean).join('')
const email = (e: string) => <a href={`mailto:${e}`} className="text-violeta underline-offset-2 hover:underline">{e}</a>

/**
 * Política de privacidade (LGPD): o que o Mostra coleta, para quê, com quem compartilha, onde fica, por quanto
 * tempo e como exercer os direitos. Escrita a partir do que o produto faz de fato (lib/api, db/migrations,
 * wrangler.jsonc); dados da empresa em lib/legal.ts.
 */
const SECOES: SecaoLegal[] = [
  {
    id: 'quem',
    titulo: 'Quem somos',
    corpo: (
      <>
        <p>O {E.marca} ({E.site}){OPERADOR} (“{E.marca}”, “nós”). Para os dados pessoais tratados para oferecer o serviço, somos o <strong>controlador</strong>, nos termos da Lei Geral de Proteção de Dados (Lei 13.709/2018, “LGPD”).</p>
        <p>Encarregado pelo tratamento de dados pessoais{E.encarregado ? `: ${E.encarregado}` : ''}, pelo e-mail {email(E.emailPrivacidade)}.</p>
        <p>Quando você usa o {E.marca} para criar apresentações com dados de outras pessoas (clientes, equipe, alunos), quem decide o que entra nelas é você: nesse conteúdo, você é o controlador e nós tratamos os dados em seu nome.</p>
      </>
    ),
  },
  {
    id: 'dados',
    titulo: 'Quais dados coletamos',
    corpo: (
      <>
        <p><strong>Conta.</strong> Nome, e-mail e senha (guardada pelo provedor de autenticação apenas como resumo criptográfico, nunca em texto). Se você entra com o Google, recebemos do Google o nome, o e-mail e a foto do perfil.</p>
        <p><strong>O que você cria e envia.</strong> Projetos, telas, textos, notas do apresentador, imagens, vídeos, PDFs, vetores e modelos 3D, kits de marca (logo, cores, fontes e o manual da marca revisado) e os e-mails de quem você convida para o seu espaço de trabalho.</p>
        <p><strong>Uso da IA.</strong> Quando você usa o Criar com IA ou os recursos de IA do editor, o pedido, o material que você anexou e as informações de marca são enviados ao provedor de IA para gerar o resultado. Guardamos um registro de uso (tipo de geração, modelo, créditos e se deu certo), não uma cópia extra do conteúdo.</p>
        <p><strong>Links de apresentação.</strong> Quantas vezes cada link foi aberto. A senha de um link é guardada só como resumo criptográfico; as tentativas de senha guardam o endereço IP também em forma de resumo (não reversível), para bloquear tentativas em série.</p>
        <p><strong>Dados técnicos.</strong> O endereço IP é usado no momento da requisição para limitar abusos (sempre em forma de resumo quando guardado). O provedor de hospedagem mantém registros de erros e desempenho por tempo limitado. Não usamos ferramentas de publicidade nem rastreadores de terceiros.</p>
        <p><strong>Pagamentos.</strong> Os dados de cartão, Pix ou boleto são tratados pelo provedor de pagamento. Nós recebemos apenas o necessário para a assinatura e as notas (plano, status, valores, datas e identificação do cliente no provedor).</p>
        <p><strong>O que fica só no seu navegador.</strong> A leitura de PDFs escaneados (reconhecimento de texto), do manual da marca e das cores do logo é feita no próprio navegador, sem enviar o arquivo para a IA. Só vai para a IA se você clicar em uma opção “com IA”, sempre com o custo à vista.</p>
      </>
    ),
  },
  {
    id: 'finalidades',
    titulo: 'Para que usamos e com que base legal',
    corpo: (
      <Lista
        itens={[
          <><strong>Prestar o serviço</strong> (criar a conta, salvar e exibir projetos, gerar telas com IA, publicar links, edição em equipe, cobrança): execução do contrato (art. 7º, V, da LGPD).</>,
          <><strong>Segurança e prevenção de abuso</strong> (limites por IP, bloqueio de tentativas de senha, registros de erro, auditoria de ações sensíveis): legítimo interesse (art. 7º, IX) e proteção do crédito e de fraudes.</>,
          <><strong>Obrigações legais e fiscais</strong> (notas e registros de pagamento): cumprimento de obrigação legal (art. 7º, II).</>,
          <><strong>Avisos sobre a conta</strong> (segurança, cobrança, mudanças nestes termos): execução do contrato.</>,
          <><strong>Novidades e ofertas por e-mail</strong>: só com o seu consentimento, que pode ser retirado a qualquer momento pelo link no próprio e-mail.</>,
          <><strong>Melhorar o produto</strong> com métricas agregadas de uso (por exemplo, quantas apresentações foram geradas): legítimo interesse, sem olhar o conteúdo dos seus projetos.</>,
        ]}
      />
    ),
  },
  {
    id: 'ia',
    titulo: 'Inteligência artificial',
    corpo: (
      <>
        <p>As telas e os roteiros são gerados pela API do Claude, da Anthropic. Enviamos apenas o que é preciso para aquela geração (o pedido, o material anexado, o roteiro e as informações de marca). Pelos termos comerciais da Anthropic para a API, esses dados não são usados para treinar os modelos dela.</p>
        <p><strong>O {E.marca} não usa o seu conteúdo para treinar modelos de IA.</strong></p>
        <p>Evite colocar em pedidos à IA dados pessoais sensíveis (saúde, biometria, origem racial, opinião política etc.) ou informações confidenciais que você não pode compartilhar com terceiros.</p>
      </>
    ),
  },
  {
    id: 'compartilhamento',
    titulo: 'Com quem compartilhamos',
    corpo: (
      <>
        <p>Não vendemos dados pessoais. Compartilhamos apenas com os fornecedores que fazem o serviço funcionar (operadores), cada um limitado ao que precisa:</p>
        <Lista
          itens={[
            <><strong>Cloudflare</strong>: hospedagem do site e da aplicação, rede de entrega e armazenamento das mídias enviadas.</>,
            <><strong>Neon</strong>: banco de dados (contas, projetos, links, créditos) e autenticação.</>,
            <><strong>Anthropic</strong>: geração de roteiros, telas e textos com IA, quando você usa esses recursos.</>,
            <><strong>Google</strong>: login com Google, se você escolher; e as fontes do Google Fonts, carregadas pelo navegador ao exibir textos (o Google recebe o endereço IP dessa requisição).</>,
            <><strong>Provedor de pagamento</strong>: cobrança das assinaturas e dos pacotes de créditos.</>,
          ]}
        />
        <p>Também compartilhamos o que você decide compartilhar: quem tem um link publicado vê a versão publicada daquela apresentação, e os membros do seu espaço de trabalho veem os projetos dele. Podemos ainda fornecer dados quando a lei ou uma ordem judicial exigir.</p>
      </>
    ),
  },
  {
    id: 'internacional',
    titulo: 'Transferência internacional',
    corpo: (
      <p>Os servidores do banco de dados e dos provedores de IA ficam nos Estados Unidos, e a rede da Cloudflare atende de vários países. Essas transferências são feitas para executar o contrato com você (art. 33, IX, da LGPD) e com fornecedores que adotam garantias contratuais e de segurança compatíveis com a LGPD.</p>
    ),
  },
  {
    id: 'retencao',
    titulo: 'Por quanto tempo guardamos',
    corpo: (
      <Lista
        itens={[
          'Dados da conta e projetos: enquanto a conta existir. Projetos excluídos ficam na Lixeira até você apagá-los de vez.',
          'Depois da exclusão da conta: apagamos os dados em até 30 dias, inclusive as mídias, exceto o que a lei manda guardar.',
          'Registros de pagamento e notas: pelo prazo da legislação fiscal (em geral, 5 anos).',
          'Registros técnicos e de segurança: pelo tempo necessário para investigar abusos, e pelo menos 6 meses para registros de acesso, como exige o Marco Civil da Internet (Lei 12.965/2014).',
        ]}
      />
    ),
  },
  {
    id: 'seguranca',
    titulo: 'Segurança',
    corpo: (
      <>
        <p>Todo o tráfego usa HTTPS. As mídias ficam em armazenamento privado e só abrem com a sua sessão ou por um link publicado ativo; tokens de links e senhas são guardados apenas como resumo criptográfico; cada espaço de trabalho só enxerga os próprios projetos; e links podem ter senha, validade e ser revogados na hora.</p>
        <p>Nenhum sistema é totalmente inviolável. Se acontecer um incidente de segurança que possa trazer risco ou dano relevante, avisaremos você e a Autoridade Nacional de Proteção de Dados (ANPD), como manda a LGPD.</p>
      </>
    ),
  },
  {
    id: 'direitos',
    titulo: 'Seus direitos',
    corpo: (
      <>
        <p>Pela LGPD (art. 18), você pode pedir a qualquer momento: confirmação de que tratamos seus dados; acesso a eles; correção; anonimização, bloqueio ou eliminação do que for desnecessário; portabilidade; informação sobre com quem compartilhamos; eliminação dos dados tratados com consentimento e a retirada desse consentimento; e a revisão de decisões tomadas só por meios automatizados.</p>
        <p>Nome e e-mail você corrige em Configurações. Para os outros pedidos, inclusive excluir a conta (Configurações → Excluir conta), escreva para {email(E.emailPrivacidade)}. Respondemos em até 15 dias e podemos pedir uma confirmação de identidade para proteger a sua conta.</p>
        <p>Se não ficar satisfeito, você também pode reclamar à ANPD (gov.br/anpd).</p>
      </>
    ),
  },
  {
    id: 'cookies',
    titulo: 'Cookies e armazenamento no navegador',
    corpo: (
      <>
        <p>Usamos só o necessário para o serviço funcionar, sem cookies de publicidade:</p>
        <Lista
          itens={[
            <><strong>Sessão de login</strong> (cookies do provedor de autenticação): mantêm você conectado com segurança.</>,
            <><strong>Tema</strong> (cookie <code className="font-mono text-[14px]">tema</code>, 1 ano): lembra se você prefere o tema claro, escuro ou automático.</>,
            <><strong>Armazenamento local da aba</strong>: guarda preferências e a conversa do Criar com IA enquanto a aba estiver aberta, para você voltar de onde parou.</>,
          ]}
        />
        <p>Bloquear esses cookies no navegador impede o login.</p>
      </>
    ),
  },
  {
    id: 'menores',
    titulo: 'Crianças e adolescentes',
    corpo: <p>O {E.marca} não é destinado a menores de 13 anos. Adolescentes de 13 a 17 anos só podem usar com autorização e acompanhamento dos pais ou responsáveis, e o uso em escolas deve seguir as regras da instituição.</p>,
  },
  {
    id: 'mudancas',
    titulo: 'Mudanças nesta política',
    corpo: <p>Podemos atualizar esta política quando o produto ou a lei mudarem. A data no topo indica a versão em vigor; se a mudança for relevante, avisaremos por e-mail ou dentro do produto antes de ela valer.</p>,
  },
  {
    id: 'contato',
    titulo: 'Contato',
    corpo: <p>Dúvidas sobre privacidade{(E.emailPrivacidade as string) !== E.emailContato ? <>: {email(E.emailPrivacidade)}. Outros assuntos: {email(E.emailContato)}</> : <> ou qualquer outro assunto: {email(E.emailContato)}</>}. Veja também os <a href="/termos" className="text-violeta underline-offset-2 hover:underline">Termos de uso</a>.</p>,
  },
]

export default function PaginaPrivacidade() {
  return (
    <>
      <JsonLd nos={[jsonLdBreadcrumb([{ nome: 'Início', caminho: '/' }, { nome: 'Política de privacidade', caminho: '/privacidade' }]), jsonLdWebPage('/privacidade')]} />
      <PaginaLegal
        titulo="Política de privacidade"
        atualizacao={VERSAO_LEGAL.privacidade}
        resumo={<p>Em resumo: usamos seus dados para o {E.marca} funcionar, não vendemos nada a ninguém, não usamos o seu conteúdo para treinar IA e você pode pedir acesso, correção ou exclusão quando quiser. Abaixo está o detalhe de cada ponto.</p>}
        secoes={SECOES}
      />
    </>
  )
}
