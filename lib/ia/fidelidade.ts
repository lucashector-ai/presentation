/**
 * Conferência do roteiro contra o pedido, depois do modelo e antes de voltar ao cliente (sem IA, grátis):
 * - a estrutura explícita do pedido manda: os títulos e subtítulos dados ficam exatamente como foram pedidos e,
 *   se o modelo devolveu telas a menos, as que faltam entram no lugar certo, montadas dos dados do pedido;
 * - nada de campos para preencher ("[data]", "[Nome]") nem de telas de imagem sem foto quando o pedido não tem
 *   imagens; nada de paleta/tipografia fora de identidade visual.
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

/** A tela do roteiro corresponde à tela pedida? (palavras do nome/título pedido no título ou rótulo da tela) */
function corresponde(t: TelaRoteiro, p: TelaPedida): boolean {
  if (p.titulo && t.titulo.trim().toLowerCase() === p.titulo.trim().toLowerCase()) return true
  const alvo = new Set(radicais(`${t.titulo} ${t.rotulo} ${t.texto}`))
  const q = radicais(`${p.nome} ${p.titulo}`)
  return q.length > 0 && q.filter((x) => alvo.has(x)).length / q.length >= 0.5
}

export function ajustarRoteiroAoPedido(r0: Roteiro, p: PedidoRoteiro, tipo: TipoApresentacao): Roteiro {
  const analise = analisarPedido(p.prompt)
  const estrutura = analise.estrutura
  let telas = r0.telas.map((t) => ({ ...t, itens: [...t.itens] }))

  // telas a menos com estrutura explícita do tamanho pedido: encaixa as que faltam, na ordem do pedido
  if (estrutura.length === p.telas && telas.length < p.telas) {
    const locais = roteiroDaEstrutura(p.prompt, { marca: p.marca.nome })?.telas ?? []
    const saida: TelaRoteiro[] = []
    let j = 0
    estrutura.forEach((e, i) => {
      if (j < telas.length && (corresponde(telas[j]!, e) || telas.length - j >= estrutura.length - i)) saida.push(telas[j++]!)
      else if (locais[i]) saida.push({ rotulo: '', ...locais[i]!, itens: locais[i]!.itens.slice(0, 8) } as TelaRoteiro)
    })
    telas = saida.slice(0, p.telas)
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
