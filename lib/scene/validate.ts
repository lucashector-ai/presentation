/**
 * Validação semântica (além do schema): referências cruzadas, segurança de links,
 * compatibilidade trigger/ação, acessibilidade e prevenção de ciclos.
 * Usada pelo editor (avisos ao designer) e pelo backend (rejeita antes de gravar/publicar).
 */
import {
  ACOES_POR_TRIGGER,
  DocumentoProjetoSchema,
  camadaTemTextoVisivel,
  type Camada,
  type Cena,
  type DocumentoProjeto,
} from './schema'

export type Gravidade = 'erro' | 'aviso'

export interface Problema {
  gravidade: Gravidade
  codigo: string
  mensagem: string
  sceneId?: string
  layerId?: string
}

export interface ResultadoValidacao {
  ok: boolean
  erros: Problema[]
  avisos: Problema[]
  /** Documento normalizado (com defaults aplicados) quando o schema passou. */
  documento?: DocumentoProjeto
}

export interface OpcoesValidacao {
  /** IDs de assets que existem no workspace. Se omitido, referências a assets não são checadas. */
  assetsExistentes?: ReadonlySet<string>
}

const PROTOCOLOS_PERIGOSOS = /^(javascript|data|vbscript|file|blob|about):/i

export function validarDocumento(entrada: unknown, opcoes: OpcoesValidacao = {}): ResultadoValidacao {
  const parsed = DocumentoProjetoSchema.safeParse(entrada)
  if (!parsed.success) {
    const erros: Problema[] = parsed.error.issues.map((i) => ({
      gravidade: 'erro',
      codigo: 'schema',
      mensagem: `${i.path.join('.') || '(raiz)'}: ${i.message}`,
    }))
    return { ok: false, erros, avisos: [] }
  }
  const doc = parsed.data
  const problemas: Problema[] = []
  const add = (p: Problema) => problemas.push(p)

  // IDs únicos de cenas
  const idsCena = new Set<string>()
  for (const cena of doc.scenes) {
    if (idsCena.has(cena.id)) add({ gravidade: 'erro', codigo: 'cena_duplicada', mensagem: `Cena "${cena.id}" repetida`, sceneId: cena.id })
    idsCena.add(cena.id)
  }

  for (const cena of doc.scenes) {
    validarCena(cena, doc, idsCena, opcoes, add)
  }

  const erros = problemas.filter((p) => p.gravidade === 'erro')
  const avisos = problemas.filter((p) => p.gravidade === 'aviso')
  return { ok: erros.length === 0, erros, avisos, documento: doc }
}

function validarCena(
  cena: Cena,
  doc: DocumentoProjeto,
  idsCena: ReadonlySet<string>,
  opcoes: OpcoesValidacao,
  add: (p: Problema) => void
) {
  const idsCamada = new Map<string, Camada>()
  for (const camada of cena.layers) {
    if (idsCamada.has(camada.id)) {
      add({ gravidade: 'erro', codigo: 'camada_duplicada', mensagem: `Camada "${camada.id}" repetida na cena`, sceneId: cena.id, layerId: camada.id })
    }
    idsCamada.set(camada.id, camada)
  }

  if (cena.backgroundAssetId && opcoes.assetsExistentes && !opcoes.assetsExistentes.has(cena.backgroundAssetId)) {
    add({ gravidade: 'erro', codigo: 'asset_inexistente', mensagem: 'Fundo da cena aponta para mídia inexistente', sceneId: cena.id })
  }

  for (const camada of cena.layers) {
    const ctx = { sceneId: cena.id, layerId: camada.id }

    // assets
    if ((camada.type === 'image' || camada.type === 'video') && opcoes.assetsExistentes && !opcoes.assetsExistentes.has(camada.assetId)) {
      add({ gravidade: 'erro', codigo: 'asset_inexistente', mensagem: `Mídia "${camada.assetId}" não existe neste workspace`, ...ctx })
    }
    if (camada.type === 'video' && camada.autoplay && !camada.muted) {
      add({ gravidade: 'aviso', codigo: 'autoplay_com_som', mensagem: 'Vídeo com autoplay precisa estar mudo; o navegador vai bloquear o som', ...ctx })
    }

    // hotspot sem interação é inútil
    if (camada.type === 'hotspot' && !camada.interaction) {
      add({ gravidade: 'aviso', codigo: 'hotspot_sem_acao', mensagem: 'Hotspot sem ação configurada', ...ctx })
    }

    const inter = camada.interaction
    if (!inter) continue

    // compatibilidade trigger/ação
    if (!ACOES_POR_TRIGGER[inter.trigger].includes(inter.do.action)) {
      add({ gravidade: 'erro', codigo: 'acao_incompativel', mensagem: `Ação "${inter.do.action}" não é permitida para o evento "${inter.trigger}"`, ...ctx })
    }

    // scrollThreshold só em Story
    if (inter.trigger === 'scrollThreshold' && doc.mode !== 'story') {
      add({ gravidade: 'erro', codigo: 'scroll_fora_do_story', mensagem: 'Evento de rolagem só existe no modo Story', ...ctx })
    }

    // acessibilidade: elementos com ação precisam de rótulo quando não têm texto
    if (inter.trigger === 'click' && !camada.ariaLabel && !camadaTemTextoVisivel(camada)) {
      add({ gravidade: 'aviso', codigo: 'sem_rotulo', mensagem: 'Elemento clicável sem descrição para leitores de tela', ...ctx })
    }

    // hover precisa de alternativa por toque — avisamos para o designer revisar
    if (inter.trigger === 'hover' && !camada.ariaLabel && !camadaTemTextoVisivel(camada)) {
      add({ gravidade: 'aviso', codigo: 'hover_sem_rotulo', mensagem: 'Interação por hover vira toque no celular; dê um rótulo ao elemento', ...ctx })
    }

    const acao = inter.do
    switch (acao.action) {
      case 'goToScene': {
        if (!idsCena.has(acao.targetSceneId)) {
          add({ gravidade: 'erro', codigo: 'cena_alvo_inexistente', mensagem: `Cena de destino "${acao.targetSceneId}" não existe`, ...ctx })
        } else if (acao.targetSceneId === cena.id) {
          add({ gravidade: 'aviso', codigo: 'navegacao_para_si', mensagem: 'Ação navega para a própria cena', ...ctx })
        }
        break
      }
      case 'openLink': {
        if (PROTOCOLOS_PERIGOSOS.test(acao.url.trim())) {
          add({ gravidade: 'erro', codigo: 'url_perigosa', mensagem: 'Protocolo de link não permitido', ...ctx })
        }
        break
      }
      case 'toggleLayer':
      case 'animate':
      case 'toggleVideo': {
        const alvo = idsCamada.get(acao.targetLayerId)
        if (!alvo) {
          add({ gravidade: 'erro', codigo: 'camada_alvo_inexistente', mensagem: `Camada de destino "${acao.targetLayerId}" não existe nesta cena`, ...ctx })
        } else if (acao.action === 'toggleVideo' && alvo.type !== 'video') {
          add({ gravidade: 'erro', codigo: 'alvo_nao_e_video', mensagem: 'Tocar/pausar só funciona em camadas de vídeo', ...ctx })
        }
        break
      }
      case 'nextScene':
      case 'prevScene':
        break
    }
  }
}

/** Atalho usado pela UI: lista mensagens prontas para exibir. */
export function resumirProblemas(r: ResultadoValidacao): string[] {
  return [...r.erros, ...r.avisos].map((p) => `${p.gravidade === 'erro' ? 'Erro' : 'Aviso'}: ${p.mensagem}`)
}
