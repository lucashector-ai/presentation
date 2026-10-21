/**
 * Validação semântica (além do schema): referências cruzadas, segurança de links,
 * compatibilidade trigger/ação, acessibilidade e prevenção de ciclos.
 * Usada pelo editor (avisos ao designer) e pelo backend (rejeita antes de gravar/publicar).
 */
import { migrarDocumento } from './migrar'
import {
  ACOES_POR_TRIGGER,
  DocumentoProjetoSchema,
  assetsDaCamada,
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
  const parsed = DocumentoProjetoSchema.safeParse(migrarDocumento(entrada))
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
    add({ gravidade: 'erro', codigo: 'asset_inexistente', mensagem: 'Fundo da tela aponta para mídia inexistente', sceneId: cena.id })
  }
  if (doc.mode === 'explorar' && !cena.map) {
    add({ gravidade: 'aviso', codigo: 'sem_posicao_mapa', mensagem: 'Tela sem posição no mapa do modo Explorar (será posicionada automaticamente)', sceneId: cena.id })
  }

  for (const camada of cena.layers) {
    const ctx = { sceneId: cena.id, layerId: camada.id }

    // assets referenciados precisam pertencer ao workspace
    if (opcoes.assetsExistentes) {
      for (const a of assetsDaCamada(camada)) {
        if (!opcoes.assetsExistentes.has(a)) add({ gravidade: 'erro', codigo: 'asset_inexistente', mensagem: `Mídia "${a}" não existe neste workspace`, ...ctx })
      }
    }
    if (camada.type === 'video' && camada.autoplay && !camada.muted) {
      add({ gravidade: 'aviso', codigo: 'autoplay_com_som', mensagem: 'Vídeo com autoplay precisa estar mudo; o navegador vai bloquear o som', ...ctx })
    }
    if (camada.type === 'svg' && camada.markup && /<script|on[a-z]+\s*=|javascript:/i.test(camada.markup)) {
      add({ gravidade: 'erro', codigo: 'svg_inseguro', mensagem: 'SVG contém código ativo; cole novamente para sanitizar', ...ctx })
    }
    if (camada.type === 'model3d' && !camada.posterAssetId) {
      add({ gravidade: 'aviso', codigo: 'modelo_sem_poster', mensagem: 'Modelo 3D sem imagem de capa: o convidado verá um espaço vazio enquanto carrega', ...ctx })
    }

    // frames: pai precisa existir, ser frame e não formar ciclo
    if (camada.parentId) {
      const pai = idsCamada.get(camada.parentId)
      if (!pai) add({ gravidade: 'aviso', codigo: 'pai_inexistente', mensagem: 'Camada aponta para um frame que não existe (será tratada como solta)', ...ctx })
      else if (pai.type !== 'frame') add({ gravidade: 'erro', codigo: 'pai_nao_e_frame', mensagem: 'Só frames podem conter outras camadas', ...ctx })
      else {
        const vistos = new Set([camada.id])
        let p: Camada | undefined = pai
        while (p) {
          if (vistos.has(p.id)) { add({ gravidade: 'erro', codigo: 'ciclo_de_frames', mensagem: 'Frames aninhados formam um ciclo', ...ctx }); break }
          vistos.add(p.id)
          p = p.parentId ? idsCamada.get(p.parentId) : undefined
        }
      }
    }
    if ((camada.sizingW === 'fill' || camada.sizingH === 'fill') && !(camada.parentId && idsCamada.get(camada.parentId)?.type === 'frame' && (idsCamada.get(camada.parentId) as { layout?: unknown }).layout)) {
      add({ gravidade: 'aviso', codigo: 'fill_sem_auto_layout', mensagem: '“Preencher” só vale dentro de um frame com auto layout (fica fixo)', ...ctx })
    }

    // hotspot sem interação é inútil
    if (camada.type === 'hotspot' && camada.interactions.length === 0) {
      add({ gravidade: 'aviso', codigo: 'hotspot_sem_acao', mensagem: 'Hotspot sem ação configurada', ...ctx })
    }

    for (const inter of camada.interactions) {
      validarInteracao(inter, camada, cena, doc, idsCena, idsCamada, add)
    }
  }
}

function validarInteracao(
  inter: Camada['interactions'][number],
  camada: Camada,
  cena: Cena,
  doc: DocumentoProjeto,
  idsCena: ReadonlySet<string>,
  idsCamada: ReadonlyMap<string, Camada>,
  add: (p: Problema) => void
) {
  const ctx = { sceneId: cena.id, layerId: camada.id }
  {
    // compatibilidade trigger/ação
    if (!ACOES_POR_TRIGGER[inter.trigger].includes(inter.do.action)) {
      add({ gravidade: 'erro', codigo: 'acao_incompativel', mensagem: `Ação "${inter.do.action}" não é permitida para o evento "${inter.trigger}"`, ...ctx })
    }

    if (inter.trigger === 'scrollThreshold' && doc.mode !== 'story') {
      add({ gravidade: 'erro', codigo: 'scroll_fora_do_story', mensagem: 'Evento de rolagem só existe no modo Story', ...ctx })
    }

    if (inter.trigger === 'click' && !camada.ariaLabel && !camadaTemTextoVisivel(camada)) {
      add({ gravidade: 'aviso', codigo: 'sem_rotulo', mensagem: 'Elemento clicável sem descrição para leitores de tela', ...ctx })
    }

    if (inter.trigger === 'hover' && !camada.ariaLabel && !camadaTemTextoVisivel(camada)) {
      add({ gravidade: 'aviso', codigo: 'hover_sem_rotulo', mensagem: 'Interação por hover vira toque no celular; dê um rótulo ao elemento', ...ctx })
    }

    if (inter.transition?.type === 'morph' && doc.mode === 'story') {
      add({ gravidade: 'aviso', codigo: 'morph_no_story', mensagem: 'Morph não se aplica ao modo Story; será usado fade', ...ctx })
    }

    const acao = inter.do
    switch (acao.action) {
      case 'goToScene': {
        if (!idsCena.has(acao.targetSceneId)) {
          add({ gravidade: 'erro', codigo: 'cena_alvo_inexistente', mensagem: `Tela de destino "${acao.targetSceneId}" não existe`, ...ctx })
        } else if (acao.targetSceneId === cena.id) {
          add({ gravidade: 'aviso', codigo: 'navegacao_para_si', mensagem: 'Ação navega para a própria tela', ...ctx })
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
          add({ gravidade: 'erro', codigo: 'camada_alvo_inexistente', mensagem: `Camada de destino "${acao.targetLayerId}" não existe nesta tela`, ...ctx })
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
