/**
 * Dados FICTÍCIOS para o protótipo navegável e para os testes E2E. Nenhum segredo, nenhuma marca real.
 */
import { FORMATOS, SCHEMA_VERSION, type DocumentoProjeto } from '@/lib/scene/schema'
import type { AssetDemo, EstadoDemo, LinkCompartilhado, Projeto, Snapshot } from './tipos'

const AGORA = '2026-10-20T14:00:00.000Z'
const WS = 'ws-demo'

const asset = (id: string, nome: string, arquivo: string, w: number, h: number, bytes: number): AssetDemo => ({
  id,
  workspaceId: WS,
  nome,
  tipo: 'image',
  mime: 'image/png',
  bytes,
  width: w,
  height: h,
  duracao: null,
  status: 'ready',
  url: `/demo/${arquivo}.svg`,
  thumbUrl: `/demo/${arquivo}.svg`,
  posterUrl: null,
  criadoEm: AGORA,
})

export const ASSETS_DEMO: AssetDemo[] = [
  asset('as-capa', 'capa-aurora.png', 'capa', 1920, 1080, 1_240_000),
  asset('as-conceito', 'conceito-grid.png', 'conceito', 1920, 1080, 980_000),
  asset('as-logo', 'logo-aurora.png', 'logo', 1200, 1200, 420_000),
  asset('as-paleta', 'paleta.png', 'paleta', 1920, 1080, 610_000),
  asset('as-cartao', 'mockup-cartao.png', 'mockup-cartao', 1600, 1000, 1_880_000),
  asset('as-fachada', 'mockup-fachada.png', 'mockup-fachada', 1920, 1080, 2_310_000),
  asset('as-story-1', 'primavera-01.png', 'story-1', 1080, 1920, 1_020_000),
  asset('as-story-2', 'primavera-02.png', 'story-2', 1080, 1920, 1_110_000),
  asset('as-story-3', 'primavera-03.png', 'story-3', 1080, 1920, 990_000),
]

const S = FORMATOS.slides169

export const DOC_AURORA: DocumentoProjeto = {
  schemaVersion: SCHEMA_VERSION,
  mode: 'slides',
  scenes: [
    {
      id: 'scene-01', title: 'Capa', size: S, background: '#101820', backgroundFit: 'cover', backgroundAssetId: 'as-capa',
      layers: [
        { id: 'titulo', type: 'text', text: 'Café Aurora', x: 160, y: 300, width: 1100, height: 180, rotation: 0, opacity: 1, z: 1, locked: false, hidden: false, fontFamily: 'system-ui', fontSize: 140, fontWeight: 700, color: '#F3F5F2', align: 'left', lineHeight: 1.05, letterSpacing: -2,
          enterAnimation: { type: 'slideUp', duration: 600, delay: 0, easing: 'easeOut' } },
        { id: 'sub', type: 'text', text: 'Identidade visual — proposta 01', x: 160, y: 500, width: 900, height: 80, rotation: 0, opacity: 1, z: 2, locked: false, hidden: false, fontFamily: 'system-ui', fontSize: 44, fontWeight: 400, color: '#B5D8C2', align: 'left', lineHeight: 1.2, letterSpacing: 0,
          enterAnimation: { type: 'fadeIn', duration: 600, delay: 250, easing: 'easeOut' } },
        { id: 'cta', type: 'text', text: 'Começar →', ariaLabel: 'Começar apresentação', x: 160, y: 820, width: 300, height: 70, rotation: 0, opacity: 1, z: 3, locked: false, hidden: false, fontFamily: 'system-ui', fontSize: 36, fontWeight: 600, color: '#D9F99D', align: 'left', lineHeight: 1.2, letterSpacing: 0,
          interaction: { trigger: 'click', conditions: { once: false, threshold: 0.5 }, do: { action: 'nextScene' } } },
      ],
    },
    {
      id: 'scene-02', title: 'Conceito', size: S, background: '#EEF1EC', backgroundFit: 'cover',
      layers: [
        { id: 'grid', type: 'image', assetId: 'as-conceito', fit: 'cover', radius: 0, shadow: false, x: 0, y: 0, width: 1920, height: 1080, rotation: 0, opacity: 1, z: 0, locked: true, hidden: false },
        { id: 'txt', type: 'text', text: 'Calor, luz da manhã e precisão artesanal.', x: 220, y: 240, width: 640, height: 500, rotation: 0, opacity: 1, z: 1, locked: false, hidden: false, fontFamily: 'Georgia', fontSize: 64, fontWeight: 400, color: '#F3F5F2', align: 'left', lineHeight: 1.15, letterSpacing: 0,
          enterAnimation: { type: 'fadeIn', duration: 700, delay: 100, easing: 'easeOut' } },
        { id: 'hs-marca', type: 'hotspot', ariaLabel: 'Ver a marca', hint: true, x: 1040, y: 160, width: 720, height: 360, rotation: 0, opacity: 1, z: 2, locked: false, hidden: false,
          interaction: { trigger: 'click', conditions: { once: false, threshold: 0.5 }, do: { action: 'goToScene', targetSceneId: 'scene-03' }, transition: { type: 'zoom', duration: 400 } } },
        { id: 'hs-paleta', type: 'hotspot', ariaLabel: 'Ver a paleta de cores', hint: true, x: 1040, y: 560, width: 340, height: 360, rotation: 0, opacity: 1, z: 3, locked: false, hidden: false,
          interaction: { trigger: 'click', conditions: { once: false, threshold: 0.5 }, do: { action: 'goToScene', targetSceneId: 'scene-04' } } },
        { id: 'hs-aplic', type: 'hotspot', ariaLabel: 'Ver aplicações', hint: true, x: 1420, y: 560, width: 340, height: 360, rotation: 0, opacity: 1, z: 4, locked: false, hidden: false,
          interaction: { trigger: 'click', conditions: { once: false, threshold: 0.5 }, do: { action: 'goToScene', targetSceneId: 'scene-05' } } },
      ],
    },
    {
      id: 'scene-03', title: 'Marca', size: S, background: '#F6F7F5', backgroundFit: 'cover',
      layers: [
        { id: 'logo', type: 'image', assetId: 'as-logo', fit: 'contain', radius: 0, shadow: true, x: 360, y: 180, width: 720, height: 720, rotation: 0, opacity: 1, z: 1, locked: false, hidden: false,
          enterAnimation: { type: 'scaleIn', duration: 500, delay: 0, easing: 'easeOut' } },
        { id: 'legenda', type: 'text', text: 'Símbolo: o arco do sol nascente sobre a xícara. Funciona de 16 px a fachada.', x: 1180, y: 380, width: 560, height: 300, rotation: 0, opacity: 1, z: 2, locked: false, hidden: false, fontFamily: 'system-ui', fontSize: 36, fontWeight: 400, color: '#101820', align: 'left', lineHeight: 1.35, letterSpacing: 0 },
        { id: 'detalhe', type: 'text', text: 'Versão monocromática disponível em todas as aplicações.', x: 1180, y: 700, width: 560, height: 120, rotation: 0, opacity: 1, z: 3, locked: false, hidden: true, fontFamily: 'system-ui', fontSize: 28, fontWeight: 400, color: '#5B6670', align: 'left', lineHeight: 1.35, letterSpacing: 0 },
        { id: 'hs-logo', type: 'hotspot', ariaLabel: 'Mostrar detalhe do símbolo', hint: false, x: 360, y: 180, width: 720, height: 720, rotation: 0, opacity: 1, z: 4, locked: false, hidden: false,
          interaction: { trigger: 'hover', conditions: { once: false, threshold: 0.5 }, do: { action: 'toggleLayer', targetLayerId: 'detalhe', mode: 'toggle' } } },
        { id: 'voltar', type: 'text', text: '← Conceito', ariaLabel: 'Voltar ao conceito', x: 160, y: 960, width: 300, height: 60, rotation: 0, opacity: 1, z: 5, locked: false, hidden: false, fontFamily: 'system-ui', fontSize: 28, fontWeight: 500, color: '#5B6670', align: 'left', lineHeight: 1.2, letterSpacing: 0,
          interaction: { trigger: 'click', conditions: { once: false, threshold: 0.5 }, do: { action: 'goToScene', targetSceneId: 'scene-02' } } },
      ],
    },
    {
      id: 'scene-04', title: 'Paleta', size: S, background: '#F6F7F5', backgroundFit: 'cover', backgroundAssetId: 'as-paleta',
      layers: [
        { id: 't1', type: 'text', text: 'Grafite · Menta · Ardósia · Lima', x: 120, y: 100, width: 1200, height: 90, rotation: 0, opacity: 1, z: 1, locked: false, hidden: false, fontFamily: 'system-ui', fontSize: 56, fontWeight: 600, color: '#101820', align: 'left', lineHeight: 1.1, letterSpacing: -1,
          enterAnimation: { type: 'slideLeft', duration: 500, delay: 0, easing: 'easeOut' } },
        { id: 'voltar4', type: 'text', text: '← Conceito', ariaLabel: 'Voltar ao conceito', x: 120, y: 960, width: 300, height: 60, rotation: 0, opacity: 1, z: 2, locked: false, hidden: false, fontFamily: 'system-ui', fontSize: 28, fontWeight: 500, color: '#5B6670', align: 'left', lineHeight: 1.2, letterSpacing: 0,
          interaction: { trigger: 'click', conditions: { once: false, threshold: 0.5 }, do: { action: 'goToScene', targetSceneId: 'scene-02' } } },
      ],
    },
    {
      id: 'scene-05', title: 'Aplicações', size: S, background: '#DCE3DA', backgroundFit: 'cover',
      layers: [
        { id: 'cartao', type: 'image', assetId: 'as-cartao', fit: 'cover', radius: 24, shadow: true, x: 120, y: 140, width: 800, height: 500, rotation: 0, opacity: 1, z: 1, locked: false, hidden: false,
          enterAnimation: { type: 'slideUp', duration: 500, delay: 0, easing: 'easeOut' } },
        { id: 'fachada', type: 'image', assetId: 'as-fachada', fit: 'cover', radius: 24, shadow: true, x: 1000, y: 140, width: 800, height: 450, rotation: 0, opacity: 1, z: 2, locked: false, hidden: false,
          enterAnimation: { type: 'slideUp', duration: 500, delay: 150, easing: 'easeOut' } },
        { id: 'leg', type: 'text', text: 'Papelaria, fachada e embalagens. Clique na fachada para ampliar.', x: 120, y: 720, width: 1200, height: 100, rotation: 0, opacity: 1, z: 3, locked: false, hidden: false, fontFamily: 'system-ui', fontSize: 36, fontWeight: 400, color: '#101820', align: 'left', lineHeight: 1.3, letterSpacing: 0 },
        { id: 'hs-fachada', type: 'hotspot', ariaLabel: 'Ampliar fachada', hint: true, x: 1000, y: 140, width: 800, height: 450, rotation: 0, opacity: 1, z: 4, locked: false, hidden: false,
          interaction: { trigger: 'click', conditions: { once: false, threshold: 0.5 }, do: { action: 'goToScene', targetSceneId: 'scene-06' }, transition: { type: 'zoom', duration: 450 } } },
        { id: 'voltar5', type: 'text', text: '← Conceito', ariaLabel: 'Voltar ao conceito', x: 120, y: 960, width: 300, height: 60, rotation: 0, opacity: 1, z: 5, locked: false, hidden: false, fontFamily: 'system-ui', fontSize: 28, fontWeight: 500, color: '#5B6670', align: 'left', lineHeight: 1.2, letterSpacing: 0,
          interaction: { trigger: 'click', conditions: { once: false, threshold: 0.5 }, do: { action: 'goToScene', targetSceneId: 'scene-02' } } },
      ],
    },
    {
      id: 'scene-06', title: 'Fachada', size: S, background: '#101820', backgroundFit: 'cover', backgroundAssetId: 'as-fachada',
      layers: [
        { id: 'fechar', type: 'text', text: '✕', ariaLabel: 'Fechar ampliação', x: 1780, y: 60, width: 80, height: 80, rotation: 0, opacity: 1, z: 1, locked: false, hidden: false, fontFamily: 'system-ui', fontSize: 48, fontWeight: 400, color: '#F3F5F2', align: 'center', lineHeight: 1.2, letterSpacing: 0,
          interaction: { trigger: 'click', conditions: { once: false, threshold: 0.5 }, do: { action: 'goToScene', targetSceneId: 'scene-05' }, transition: { type: 'fade', duration: 300 } } },
        { id: 'link', type: 'text', text: 'Ver briefing original ↗', ariaLabel: 'Abrir briefing em nova aba', x: 120, y: 960, width: 600, height: 60, rotation: 0, opacity: 1, z: 2, locked: false, hidden: false, fontFamily: 'system-ui', fontSize: 28, fontWeight: 500, color: '#D9F99D', align: 'left', lineHeight: 1.2, letterSpacing: 0,
          interaction: { trigger: 'click', conditions: { once: false, threshold: 0.5 }, do: { action: 'openLink', url: 'https://example.com/briefing', newTab: true } } },
      ],
    },
  ],
}

const V = FORMATOS.story

export const DOC_PRIMAVERA: DocumentoProjeto = {
  schemaVersion: SCHEMA_VERSION,
  mode: 'story',
  scenes: [
    { id: 'st-01', title: 'Abertura', size: V, background: '#D9F99D', backgroundFit: 'cover', backgroundAssetId: 'as-story-1',
      layers: [
        { id: 'h', type: 'text', text: 'Campanha Primavera', x: 90, y: 1150, width: 900, height: 200, rotation: 0, opacity: 1, z: 1, locked: false, hidden: false, fontFamily: 'system-ui', fontSize: 96, fontWeight: 700, color: '#101820', align: 'left', lineHeight: 1.05, letterSpacing: -2,
          interaction: { trigger: 'scrollThreshold', conditions: { once: true, threshold: 0.4 }, do: { action: 'animate', targetLayerId: 'h', animation: { type: 'slideUp', duration: 600, delay: 0, easing: 'easeOut' } } } },
      ] },
    { id: 'st-02', title: 'Produto', size: V, background: '#101820', backgroundFit: 'cover', backgroundAssetId: 'as-story-2',
      layers: [
        { id: 'p', type: 'text', text: 'Três sabores, uma estação.', x: 120, y: 1380, width: 840, height: 160, rotation: 0, opacity: 1, z: 1, locked: false, hidden: false, fontFamily: 'Georgia', fontSize: 64, fontWeight: 400, color: '#F3F5F2', align: 'left', lineHeight: 1.15, letterSpacing: 0,
          interaction: { trigger: 'scrollThreshold', conditions: { once: true, threshold: 0.5 }, do: { action: 'animate', targetLayerId: 'p', animation: { type: 'fadeIn', duration: 700, delay: 0, easing: 'easeOut' } } } },
      ] },
    { id: 'st-03', title: 'Chamada', size: V, background: '#F6F7F5', backgroundFit: 'cover', backgroundAssetId: 'as-story-3',
      layers: [
        { id: 'c', type: 'text', text: 'Lançamento 21.09', x: 120, y: 1620, width: 840, height: 120, rotation: 0, opacity: 1, z: 1, locked: false, hidden: false, fontFamily: 'system-ui', fontSize: 72, fontWeight: 700, color: '#101820', align: 'left', lineHeight: 1.1, letterSpacing: -1 },
      ] },
  ],
}

const proj = (p: Omit<Projeto, 'workspaceId' | 'descricao' | 'excluidoEm' | 'criadoEm' | 'atualizadoEm'> & Partial<Projeto>): Projeto => ({
  workspaceId: WS, descricao: '', excluidoEm: null, criadoEm: '2026-10-01T10:00:00.000Z', atualizadoEm: AGORA, ...p,
})

export const PROJETOS_DEMO: Projeto[] = [
  proj({ id: 'pr-aurora', nome: 'Café Aurora — Identidade visual', slug: 'cafe-aurora', modo: 'slides', status: 'published', coverAssetId: 'as-capa', revisaoAtual: 7, revisaoPublicada: 7, documento: DOC_AURORA, descricao: 'Proposta 01 de identidade: conceito, marca, paleta e aplicações.' }),
  proj({ id: 'pr-primavera', nome: 'Campanha Primavera (story)', slug: 'campanha-primavera', modo: 'story', status: 'draft', coverAssetId: 'as-story-1', revisaoAtual: 3, revisaoPublicada: null, documento: DOC_PRIMAVERA, atualizadoEm: '2026-10-18T09:30:00.000Z' }),
  proj({ id: 'pr-arquivado', nome: 'Rebrand 2025 (arquivado)', slug: 'rebrand-2025', modo: 'slides', status: 'archived', coverAssetId: 'as-paleta', revisaoAtual: 12, revisaoPublicada: 11, documento: { schemaVersion: 1, mode: 'slides', scenes: [{ id: 's1', title: 'Capa', size: S, background: '#101820', backgroundFit: 'cover', layers: [] }] }, atualizadoEm: '2026-06-02T09:30:00.000Z' }),
]

/** Token fixo de demonstração (não é segredo: só existe em modo demo). */
export const TOKEN_DEMO = 'demo_cafe_aurora_proposta_01_token_fixo_xx'

export const LINKS_DEMO: LinkCompartilhado[] = [
  { id: 'lk-1', projectId: 'pr-aurora', tokenHash: 'demo', tokenPreview: 'demo', senhaHash: null, expiraEm: null, revogadoEm: null, visualizacoes: 14, criadoEm: '2026-10-15T12:00:00.000Z', tokenDemo: TOKEN_DEMO },
  { id: 'lk-2', projectId: 'pr-aurora', tokenHash: 'demo-revogado', tokenPreview: 'r3v0', senhaHash: null, expiraEm: null, revogadoEm: '2026-10-17T12:00:00.000Z', visualizacoes: 3, criadoEm: '2026-10-10T12:00:00.000Z', tokenDemo: 'demo_link_revogado_xxxxxxxxxxxxxxxxxxxxxxx' },
]

export const SNAPSHOTS_DEMO: Snapshot[] = [{ projectId: 'pr-aurora', revisao: 7, documento: DOC_AURORA, criadoEm: '2026-10-15T11:50:00.000Z' }]

export function estadoInicial(): EstadoDemo {
  return {
    versao: 1,
    usuario: { id: 'us-demo', nome: 'Marina Duarte', email: 'marina@estudio-exemplo.com' },
    workspace: { id: WS, nome: 'Estúdio Exemplo', planoId: 'creator', estadoAssinatura: 'ativa' },
    projetos: structuredClone(PROJETOS_DEMO),
    assets: structuredClone(ASSETS_DEMO),
    links: structuredClone(LINKS_DEMO),
    snapshots: structuredClone(SNAPSHOTS_DEMO),
    auditoria: [],
  }
}
