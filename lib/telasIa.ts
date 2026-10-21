/**
 * Tamanho das apresentações geradas com IA e o saldo explicado em TELAS, sem ancorar em "apresentações de 10
 * telas": uma apresentação pode ter de 6 até o limite do plano. Os números vêm sempre das funções de preço de
 * lib/planos.ts (custoApresentacao, apresentacoesCom), então seguem qualquer mudança de preço sem editar aqui.
 */
import { apresentacoesCom, custoApresentacao } from './planos'

/** Menor e maior apresentação que a IA gera (o limite de cada plano, `telasPorPrompt`, fica entre os dois). */
export const MIN_TELAS_IA = 6
export const MAX_TELAS_IA = 30
/** Atalhos de tamanho no Criar com IA e no painel (o campo livre aceita qualquer número no intervalo). */
export const ATALHOS_TELAS = [6, 8, 10, 12, 15, 20, 25, 30] as const

/** Apresentação usada só para diluir uma eventual parte fixa do preço na conta "créditos por tela". */
const REFERENCIA = 10

/** Créditos que cada tela custa em média (com qualquer parte fixa diluída numa apresentação de referência). */
export const creditosPorTela = () => custoApresentacao(REFERENCIA) / REFERENCIA

/** Quantas telas geradas com IA cabem num saldo (≈; arredonda para baixo). */
export function telasCom(creditos: number): number {
  const porTela = creditosPorTela()
  return porTela > 0 ? Math.max(0, Math.floor(Math.max(0, creditos) / porTela + 1e-9)) : 0
}

/** "≈ 53 telas com IA" / "≈ 1 tela com IA" / "nenhuma tela com IA". */
export function textoTelas(creditos: number): string {
  const n = telasCom(creditos)
  if (n === 0) return 'nenhuma tela com IA'
  return `≈ ${n.toLocaleString('pt-BR')} ${n === 1 ? 'tela' : 'telas'} com IA`
}

/** Exemplo concreto do que o saldo rende, sem prender a um tamanho: "≈ 4 apresentações de 10 telas ou 2 de 20". */
export function exemploApresentacoes(creditos: number): string {
  const de10 = apresentacoesCom(creditos, 10)
  const de20 = apresentacoesCom(creditos, 20)
  const fmt = (n: number) => n.toLocaleString('pt-BR')
  const ap = (n: number) => (n === 1 ? 'apresentação' : 'apresentações')
  if (de20 > 0) return `≈ ${fmt(de10)} ${ap(de10)} de 10 telas ou ${fmt(de20)} de 20`
  if (de10 > 0) return `≈ ${fmt(de10)} ${ap(de10)} de 10 telas`
  const de6 = apresentacoesCom(creditos, MIN_TELAS_IA)
  return de6 > 0 ? `≈ ${fmt(de6)} ${ap(de6)} de ${MIN_TELAS_IA} telas` : `não dá para uma apresentação de ${MIN_TELAS_IA} telas`
}

/** Saldo baixo: não cobre uma apresentação média (o aviso proativo e o cartão de créditos usam). */
export const saldoBaixo = (creditos: number) => creditos < custoApresentacao(REFERENCIA)

/** "40 créditos" / "1 crédito" / "grátis". */
export const textoCreditos = (n: number) => (n <= 0 ? 'grátis' : `${n.toLocaleString('pt-BR')} ${n === 1 ? 'crédito' : 'créditos'}`)

/** Tamanho dentro do intervalo do plano. */
export const limitarTelas = (n: number, limite: number) => Math.max(MIN_TELAS_IA, Math.min(limite, Math.round(Number.isFinite(n) ? n : MIN_TELAS_IA)))
