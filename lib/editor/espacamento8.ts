/**
 * "Ajustar espaçamento (8 px)" do editor: a regra do 8 nas DISTÂNCIAS (borda a borda entre vizinhos e de cada filho
 * até a borda do pai, como o editor mede com Alt) numa tela que já existe — gerada pela IA antes da regra ou editada
 * à mão. A lógica é a mesma da montagem (lib/ia/grade8.ts → `ajustarEspacamento`): gaps e paddings vão para a
 * escala, texto de largura automática vira largura fixa na grade, entrelinha em múltiplos de 8, itens centralizados
 * em meio passo são ajustados e o valor que acompanha a ponta de uma barra fica a 8/16/24 px dela. A altura dos
 * textos vem da medição do DOM (lib/editor/medirTexto.ts), a mesma que o canvas usa; sem DOM (testes), a altura
 * atual vale. Puro: devolve uma tela nova (a mesma, se nada mudou) — o editor grava num passo de desfazer.
 */
import { ajustarEspacamento, type CamadaGrade } from '@/lib/ia/grade8'
import { normalizarZ, novoId } from '@/lib/scene/order'
import { parseCamada, type Camada, type CamadaTexto, type Cena, type DocumentoProjeto } from '@/lib/scene/schema'
import { medirTexto } from './medirTexto'

/** Altura das linhas de um texto na largura atual (sem o padding da etiqueta, que a grade soma de volta). */
function alturaTexto(l: CamadaGrade): number {
  const pad = typeof l.padding === 'number' ? l.padding * 2 : 0
  if (typeof document === 'undefined') return Math.max(1, l.height - pad)
  const m = medirTexto({ ...(l as unknown as CamadaTexto), sizingW: 'fixed', sizingH: 'hug' })
  // (sem motor de layout, como num DOM simulado, a medida vem zerada: vale a altura atual)
  return Math.max(1, (m.height > 1 ? m.height : l.height) - pad)
}

export function ajustarEspacamentoCena(cena: Cena): Cena {
  if (!cena.layers.length) return cena
  const ids = new Set(cena.layers.map((l) => l.id))
  const uid = (papel: string) => { const id = novoId(papel, [...ids].map((i) => ({ id: i }))); ids.add(id); return id }
  const saida = ajustarEspacamento(cena.layers as unknown as CamadaGrade[], { uid, alturaTexto })
  const layers: Camada[] = []
  for (const [i, l] of saida.entries()) {
    try { layers.push(parseCamada({ ...l, z: i })) } catch { /* camada inválida: fica de fora (não acontece com camadas válidas) */ }
  }
  if (layers.length !== saida.length) return cena
  const antes = JSON.stringify(cena.layers)
  const novas = normalizarZ(layers)
  return JSON.stringify(novas) === antes ? cena : { ...cena, layers: novas }
}

export function ajustarEspacamentoDocumento(doc: DocumentoProjeto): DocumentoProjeto {
  const scenes = doc.scenes.map(ajustarEspacamentoCena)
  return scenes.every((s, i) => s === doc.scenes[i]) ? doc : { ...doc, scenes }
}
