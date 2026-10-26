/**
 * Conversa do "Criar com IA": as mensagens do agente são montadas aqui, sem IA (o que o pedido já diz, o que falta
 * decidir, o plano pronto, a apresentação pronta). Só o roteiro e o design gastam créditos. Puro e testável.
 */
export type Mensagem =
  | { id: string; de: 'pessoa'; texto: string; anexo?: { nome: string; tamanho: string } }
  | { id: string; de: 'ia'; texto: string; cartao?: 'plano' | 'apresentacao' }
  | { id: string; de: 'etapa'; texto: string; feito: boolean }

let seq = 0
export const idMensagem = () => `m${Date.now().toString(36)}${(++seq).toString(36)}`

const lista = (itens: string[]) => (itens.length <= 1 ? itens.join('') : `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}`)

/** Tamanho legível de um texto colado ("8 KB"). */
export function tamanhoTexto(texto: string): string {
  const bytes = new Blob([texto]).size
  return bytes < 1024 ? `${bytes} B` : `${Math.round(bytes / 1024)} KB`
}

/** Texto colado longo vira um anexo na conversa (o campo fica livre para uma instrução). */
export const LIMITE_ANEXO = 1200

export interface Entendimento {
  telas: number
  tipo: string
  marca: string
  publico: string
  estrutura: number
  cores: string[]
  temLogo: boolean
  temKit: boolean
  material: boolean
}

/** Primeira resposta: o que foi entendido do pedido, em uma frase ou duas. */
export function mensagemEntendimento(e: Entendimento): string {
  const para = e.marca ? ` para ${e.marca}` : ''
  const quem = e.publico ? `, pensando em ${e.publico}` : ''
  const partes = [`Vou transformar esse pedido numa apresentação de ${e.telas} telas (${e.tipo.toLowerCase()})${para}${quem}.`]
  const lidos: string[] = []
  if (e.estrutura >= 3) lidos.push(`a estrutura tela a tela (${e.estrutura} telas)`)
  if (e.cores.length) lidos.push(`as cores (${e.cores.slice(0, 3).join(', ')}${e.cores.length > 3 ? '…' : ''})`)
  if (e.material) lidos.push('o material anexado')
  if (lidos.length) partes.push(`Já reconheci ${lista(lidos)}: isso entra direto, sem digitar de novo.`)
  return partes.join(' ')
}

/** O que ainda vale decidir antes do plano (abre o painel de decisões ao lado). */
export function mensagemDecisoes(e: Pick<Entendimento, 'temLogo' | 'temKit' | 'cores' | 'marca'> & { temFontes: boolean }): string {
  if (e.temKit) return 'Usei o kit de marca salvo. Confira ao lado o logo, a identidade visual e as fontes; se estiver tudo certo, é só criar o plano.'
  const faltam: string[] = []
  if (!e.temLogo) faltam.push('o logo (não veio anexado)')
  if (!e.cores.length) faltam.push('a identidade visual (cores)')
  if (!e.temFontes) faltam.push('as fontes')
  if (!faltam.length) return 'Abri ao lado as decisões de marca com o que veio no pedido já marcado. Confira e crie o plano.'
  const semLogo = !e.temLogo ? ` Se preferir seguir sem logo, uso ${e.marca ? `“${e.marca}”` : 'o nome'} como assinatura em texto, sem inventar um símbolo.` : ''
  return `Antes de escrever o plano, abri ao lado algumas decisões: ${lista(faltam)}.${semLogo}`
}

/** Plano pronto para revisão. */
export function mensagemPlano(p: { titulo: string; telas: string[]; nota: string; ajuste?: boolean }): string {
  const n = p.telas.length
  const ini = p.telas[0]
  const fim = p.telas[n - 1]
  const caminho = ini && fim && n > 1 ? `, abrindo com “${ini}” e fechando com “${fim}”` : ''
  const comeco = p.ajuste ? `Refiz o plano com o seu ajuste: ${n} telas${caminho}.` : `O plano está pronto para revisão: ${n} telas${caminho}.`
  return `${comeco} ${p.nota ? `${p.nota} ` : ''}Edite ao lado (títulos, textos, ordem e tipo de cada tela) e, quando estiver como você quer, clique em Gerar.`
}

/** Ao gerar: o que vai acontecer. */
export function mensagemGerando(p: { telas: number; estilo: string; logo: boolean; fontes: string | null; refazer: number }): string {
  const extras = [p.logo && 'o logo', p.fontes && `as fontes ${p.fontes}`].filter(Boolean) as string[]
  const so = p.refazer && p.refazer < p.telas ? ` Só ${p.refazer === 1 ? 'a tela alterada é redesenhada' : `as ${p.refazer} telas alteradas são redesenhadas`}; as outras ficam.` : ''
  return `Vou desenhar as ${p.telas} telas a partir do plano aprovado, no estilo ${p.estilo}${extras.length ? `, com ${lista(extras)}` : ''}.${so}`
}

/** Apresentação pronta. */
export function mensagemPronta(p: { telas: number; limitado?: { limite: number; pedidas: number } | null }): string {
  const limite = p.limitado && p.limitado.pedidas > p.limitado.limite ? ` O seu plano gera até ${p.limitado.limite} telas por apresentação, então o pedido de ${p.limitado.pedidas} foi condensado nelas, sem cortar assunto.` : ''
  return `A apresentação está pronta com ${p.telas} telas.${limite} Trocar o estilo, as cores ou as fontes agora é grátis; para ajustes finos, abra no editor.`
}
