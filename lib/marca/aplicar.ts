/**
 * Perfil de marca aplicado SOBRE o estilo (depois das cores e fontes de `aplicarMarca`, em
 * lib/ia/designSystem.ts): o que o manual diz de grafismos, gradientes, sombras, cantos, caixa alta e densidade
 * ajusta o motivo decorativo e as regras de composição do estilo. Sem IA, na montagem e no desenho local.
 * Só importa tipos de designSystem (sem ciclo em tempo de execução).
 */
import type { Motivo, Regras, TemaVisual } from '@/lib/ia/designSystem'
import type { PerfilMarca } from './perfil'

const tem = (lista: string[], re: RegExp) => lista.some((s) => re.test(s.toLowerCase()))

/** Motivo decorativo que os grafismos do manual descrevem (null = o do estilo). */
export function motivoDoPerfil(p: PerfilMarca): Motivo | null {
  const g = [...p.grafismos, ...p.faz]
  if (tem([...p.grafismos, ...p.naoFaz], /sem grafismo|n[aã]o use? grafismo|evite grafismo|nenhum grafismo|sem elementos decorativos|sem ornamento/)) return 'nenhum'
  if (tem(g, /\blinhas?\b|\bfios?\b|tra[cç]os? finos/)) return 'linhas'
  if (tem(g, /\bgrade\b|\bgrid\b|malha|quadriculad/)) return 'grade'
  if (tem(g, /c[ií]rculos?|circular|bolhas?|pontos?\b|esferas?/)) return 'bolhas'
  if (tem(g, /blocos?|ret[aâ]ngulos?|faixas?|barras?|geom[eé]tric/)) return 'blocos'
  if (tem(g, /org[aâ]nic|manchas?|ondas?|fluid/)) return 'manchas'
  if (tem(g, /moldura|borda decorativa|filete/)) return 'moldura'
  if (tem(g, /brilho|luz|glow|neon/)) return 'brilho'
  return null
}

/**
 * Ajustes do estilo pelo perfil: motivo; "não usar gradiente/degradê" → fundo liso e superfícies sem gradiente;
 * "sem sombra" → cartão sem sombra dura; caixa alta pedida ou proibida; cantos retos ou arredondados; densidade
 * baixa respira mais (margem maior), alta encosta um pouco.
 */
export function aplicarPerfilAoTema(t: TemaVisual, p: PerfilMarca | null | undefined): TemaVisual {
  if (!p) return t
  const regras: Partial<Regras> = { ...t.regras }
  let out: TemaVisual = t
  const motivo = motivoDoPerfil(p)
  if (motivo) out = { ...out, motivo }
  const nao = p.naoFaz
  const faz = [...p.faz, ...p.grafismos]
  if (tem(nao, /gradiente|degrad[eê]|d[eé]grad[eé]/)) {
    regras.fundo = 'liso'
    out = { ...out, claro: { ...out.claro, gradiente: undefined }, escuro: { ...out.escuro, gradiente: undefined } }
  }
  if (tem(nao, /sombras?/) && (regras.cartao ?? 'cheio') === 'sombra') regras.cartao = 'cheio'
  if (tem(nao, /caixa alta|mai[uú]sculas|all caps|uppercase/)) regras.caixaAlta = false
  else if (tem(faz, /t[ií]tulos? em caixa alta|t[ií]tulos? em mai[uú]sculas/)) regras.caixaAlta = true
  if (tem(nao, /cantos? arredondad|bordas? arredondad|cantos? curvos/) || tem(faz, /cantos? retos|bordas? retas|sem arredondamento/)) out = { ...out, raio: 0 }
  else if (tem(faz, /cantos? arredondad|bordas? arredondad/)) out = { ...out, raio: Math.max(out.raio, 16) }
  if (p.densidade === 'baixa') regras.margem = Math.max(regras.margem ?? 1, 1.15)
  else if (p.densidade === 'alta') regras.margem = Math.min(regras.margem ?? 1, 0.92)
  return { ...out, regras }
}
