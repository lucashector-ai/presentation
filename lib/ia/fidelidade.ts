/**
 * Conferência do roteiro contra o pedido, depois do modelo e antes de voltar ao cliente (sem IA, grátis):
 * - a estrutura explícita do pedido manda: os títulos e subtítulos dados ficam exatamente como foram pedidos e,
 *   se o modelo devolveu telas a menos, as que faltam entram no lugar certo, montadas dos dados do pedido;
 * - nada de campos para preencher ("[data]", "[Nome]") nem de telas de imagem sem foto quando o pedido não tem
 *   imagens; nada de paleta/tipografia fora de identidade visual.
 * A mesma conferência vale para o design: com o manual da marca aplicado, `garantirMarcaNasCamadas`
 * (lib/marca/conferir.ts, chamado no fim de `montarDocumento`) garante as fontes e as cores da marca em todas as
 * camadas geradas, pela IA ou pelo desenho local.
 * Puro: sem rede, sem DOM.
 */
import { analisarPedido, type TelaPedida } from './analisePedido'
import { radicais, roteiroDaEstrutura } from './estruturaLocal'
import type { PedidoRoteiro } from './pedido'
import { RoteiroSchema, type Roteiro, type TelaRoteiro } from './roteiro'
import type { TipoApresentacao } from './tiposApresentacao'

/** Campos para preencher e textos de preenchimento que nunca vão para uma tela final. */
const RE_PREENCHER = /\[[^\]\n]{1,40}\]|\{\{[^}\n]{1,40}\}\}|\barraste (?:sua|a) imagem aqui\b|\blorem ipsum\b[^.]*\.?/gi
export const temPreenchimento = (s: string) => new RegExp(RE_PREENCHER.source, 'i').test(s)
/** Tira o que é campo para preencher (só quando há); os campos de um item ("a|b|c") continuam no lugar. */
const limparCampo = (s: string) => s.replace(RE_PREENCHER, '').replace(/\s+([,.;:·])/g, '$1').replace(/([·,;:])\s*(?=[·,;:]|$)/g, '').replace(/^\s*[·,;:—–-]\s*/, '').replace(/\s{2,}/g, ' ').trim()
const semPreenchimento = (s: string) => (temPreenchimento(s) ? s.split('|').map(limparCampo).join('|') : s)

/** Quanto a tela do roteiro parece a tela pedida (0 a 1; título pedido igual = 1). */
function semelhanca(t: TelaRoteiro, p: TelaPedida): number {
  if (p.titulo && t.titulo.trim().toLowerCase() === p.titulo.trim().toLowerCase()) return 1
  const alvo = new Set(radicais(`${t.titulo} ${t.rotulo} ${t.texto}`))
  const q = radicais(`${p.nome} ${p.titulo}`)
  return q.length ? q.filter((x) => alvo.has(x)).length / q.length : 0
}

export function ajustarRoteiroAoPedido(r0: Roteiro, p: PedidoRoteiro, tipo: TipoApresentacao): Roteiro {
  const analise = analisarPedido(p.prompt)
  const estrutura = analise.estrutura
  let telas = r0.telas.map((t) => ({ ...t, itens: [...t.itens] }))

  // telas a menos com estrutura explícita do tamanho pedido: encaixa as que faltam, na ordem do pedido
  if (estrutura.length === p.telas && telas.length < p.telas) {
    const locais = roteiroDaEstrutura(p.prompt, { marca: p.marca.nome })?.telas ?? []
    // alinhamento em ordem (todas as telas do modelo usadas, cada uma numa tela pedida): o que sobra na estrutura é o
    // que o modelo esqueceu. Pontua a semelhança de nome/título e a capa/encerramento nas pontas.
    const n = estrutura.length
    const m = telas.length
    const nota = (i: number, j: number) => semelhanca(telas[j]!, estrutura[i]!) + (telas[j]!.tipo === 'capa' && i === 0 ? 1 : 0) + (telas[j]!.tipo === 'encerramento' && i === n - 1 ? 1 : 0)
    const f: number[][] = Array.from({ length: n + 1 }, () => Array<number>(m + 1).fill(-Infinity))
    for (let i = 0; i <= n; i++) f[i]![0] = 0
    for (let i = 1; i <= n; i++) for (let j = 1; j <= Math.min(i, m); j++) f[i]![j] = Math.max(f[i - 1]![j]!, f[i - 1]![j - 1]! + nota(i - 1, j - 1))
    const usada: (number | null)[] = Array(n).fill(null)
    for (let i = n, j = m; i > 0; i--) {
      if (j > 0 && f[i]![j] === f[i - 1]![j - 1]! + nota(i - 1, j - 1)) { usada[i - 1] = j - 1; j-- }
    }
    telas = usada.map((j, i) => (j !== null ? telas[j]! : locais[i] ? ({ rotulo: '', ...locais[i]!, itens: locais[i]!.itens.slice(0, 8) } as TelaRoteiro) : null)).filter((t): t is TelaRoteiro => !!t).slice(0, p.telas)
  }
  // títulos e subtítulos dados no pedido ficam exatamente como pedidos (uma tela para cada tela pedida)
  if (estrutura.length === telas.length) {
    telas = telas.map((t, i) => {
      const e = estrutura[i]!
      const sub = (t.tipo === 'capa' || t.tipo === 'encerramento' || t.tipo === 'secao' || t.tipo === 'conceito') && e.subtitulo ? e.subtitulo : t.texto
      return { ...t, titulo: e.titulo || t.titulo, texto: sub }
    })
  }
  // sem fotos e sem pedido de imagens: imagem vira ideia central e galeria vira cartões (sem espaço vazio)
  // (portfólio e identidade visual são feitos de imagens: lá o espaço de imagem é o conteúdo)
  const semImagens = !analise.imagens && !p.material.fotos.length && tipo !== 'portfolio' && tipo !== 'identidade'
  const identidade = tipo === 'identidade' || /paleta|tipografia|identidade visual (?:da|de|para)/i.test(p.prompt)
  telas = telas.map((t) => {
    let x = { ...t, titulo: semPreenchimento(t.titulo) || t.titulo.replace(RE_PREENCHER, '').trim() || 'Sem título', texto: semPreenchimento(t.texto), itens: t.itens.map(semPreenchimento).filter((i) => i.replace(/\|/g, '').trim()) }
    if (semImagens && x.tipo === 'imagem') x = { ...x, tipo: 'conceito' }
    if (semImagens && x.tipo === 'galeria') x = { ...x, tipo: 'cartoes' }
    if (!identidade && x.tipo === 'tipografia') x = { ...x, tipo: 'conceito' }
    if (!identidade && x.tipo === 'paleta') x = { ...x, tipo: 'cartoes', itens: x.itens.map((i) => i.split('|')[0]!.trim()).filter(Boolean).map((i) => `${i}|`) }
    return x
  })
  return RoteiroSchema.parse({ titulo: semPreenchimento(r0.titulo) || r0.titulo, telas })
}

export { garantirMarcaNasCamadas } from '@/lib/marca/conferir'
