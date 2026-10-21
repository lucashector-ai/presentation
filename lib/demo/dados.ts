/**
 * Dados FICTÍCIOS do protótipo (mesmos projetos do Claude Design: Atlas, Maré, Fôlego, Ipê, Ruído, Orvalho, Linha 4, Sol).
 * Os documentos são escritos de forma enxuta e passam por parseDocumento, que aplica os defaults do schema.
 */
import { FORMATOS, type DocumentoProjeto } from '@/lib/scene/schema'
import { parseDocumento } from '@/lib/scene/migrar'
import type { AssetDemo, EstadoDemo, LinkCompartilhado, Projeto, Snapshot } from './tipos'

const AGORA = '2026-10-20T14:00:00.000Z'
const WS = 'ws-demo'
const S = FORMATOS.slides169
const V = FORMATOS.story

const asset = (id: string, nome: string, url: string, tipo: AssetDemo['tipo'], mime: string, w: number | null, h: number | null, bytes: number, extra: Partial<AssetDemo> = {}): AssetDemo => ({
  id, workspaceId: WS, nome, tipo, mime, bytes, width: w, height: h, duracao: null, status: 'ready', url, thumbUrl: tipo === 'image' || tipo === 'svg' ? url : null, posterUrl: null, criadoEm: AGORA, ...extra,
})

export const ASSETS_DEMO: AssetDemo[] = [
  asset('as-vaso', 'vaso-esmaltado.glb', '/demo/vaso.glb', 'model3d', 'model/gltf-binary', null, null, 123_180),
  asset('as-pulso', 'pulso.json', '/demo/pulso.json', 'lottie', 'application/json', 400, 400, 2_600),
  asset('as-capa', 'capa-aurora.png', '/demo/capa.svg', 'image', 'image/png', 1920, 1080, 1_240_000),
  asset('as-conceito', 'conceito-grid.png', '/demo/conceito.svg', 'image', 'image/png', 1920, 1080, 980_000),
  asset('as-paleta', 'paleta.png', '/demo/paleta.svg', 'image', 'image/png', 1920, 1080, 610_000),
  asset('as-cartao', 'mockup-cartao.png', '/demo/mockup-cartao.svg', 'image', 'image/png', 1600, 1000, 1_880_000),
  asset('as-fachada', 'mockup-fachada.png', '/demo/mockup-fachada.svg', 'image', 'image/png', 1920, 1080, 2_310_000),
  asset('as-story-1', 'mare-01.png', '/demo/story-1.svg', 'image', 'image/png', 1080, 1920, 1_020_000),
  asset('as-story-2', 'mare-02.png', '/demo/story-2.svg', 'image', 'image/png', 1080, 1920, 1_110_000),
  asset('as-story-3', 'mare-03.png', '/demo/story-3.svg', 'image', 'image/png', 1080, 1920, 990_000),
]

/** Símbolo da Atlas como SVG inline (mostra o tipo de camada "svg", como se tivesse sido colado do Illustrator). */
const SVG_ATLAS = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><path d="M30 170 L100 30 L170 170" fill="none" stroke="#2B1D16" stroke-width="18" stroke-linejoin="round"/><path d="M58 120 H142" stroke="#B4532A" stroke-width="18" stroke-linecap="round"/><circle cx="100" cy="30" r="12" fill="#B4532A"/></svg>'

const clique = (acao: Record<string, unknown>, transicao?: Record<string, unknown>) => ({ trigger: 'click', do: acao, ...(transicao ? { transition: transicao } : {}) })
const mono = { fontFamily: 'Geist Mono', fontSize: 22, fontWeight: 400, letterSpacing: 2, transform: 'uppercase' }

const ATLAS = {
  schemaVersion: 2,
  mode: 'slides',
  theme: { palette: 'argila', fontTitle: 'Geist', fontBody: 'Geist' },
  scenes: [
    {
      id: 'capa', title: 'Capa', size: S, background: '#EEE7DB',
      notes: 'Abrir pelo nome. A Atlas trabalha com fornos a lenha: o conceito inteiro vem daí. Pausa antes de mostrar o vaso.',
      transition: { type: 'fade', duration: 500 },
      layers: [
        { id: 'rotulo', type: 'text', text: 'Atlas Cerâmica — Identidade visual 2026', x: 120, y: 112, width: 1100, height: 40, color: '#8C6A55', ...mono },
        { id: 'linha', type: 'shape', shape: 'line', x: 0, y: 150, width: 1920, height: 2, fill: '#D9CFC2', stroke: '#D9CFC2', strokeWidth: 2 },
        { id: 'titulo', name: 'titulo', type: 'text', text: 'Atlas', x: 112, y: 330, width: 1100, height: 420, fontSize: 400, fontWeight: 500, letterSpacing: -22, lineHeight: 1, color: '#2B1D16', enterAnimation: { type: 'slideUp', duration: 800, easing: 'spring' } },
        { id: 'sub', type: 'text', text: 'Forma, fogo e tempo.', x: 120, y: 790, width: 900, height: 70, fontSize: 52, fontWeight: 400, color: '#5B4335', enterAnimation: { type: 'fadeIn', duration: 600, delay: 250 } },
        { id: 'cta', type: 'text', text: 'Ver coleção →', ariaLabel: 'Ver coleção', x: 120, y: 900, width: 330, height: 96, fontSize: 32, fontWeight: 500, color: '#EEE7DB', background: '#2B1D16', radius: 99, align: 'center', valign: 'middle', interactions: [clique({ action: 'goToScene', targetSceneId: 'aplicacoes' }, { type: 'morph', duration: 800 })] },
        { id: 'foto', name: 'foto', type: 'shape', shape: 'rect', x: 1310, y: 150, width: 490, height: 790, fill: '#B4532A', pattern: 'stripes', enterAnimation: { type: 'scaleIn', duration: 800, delay: 150, easing: 'spring' }, interactions: [{ trigger: 'hover', do: { action: 'toggleLayer', targetLayerId: 'legenda', mode: 'toggle' } }], ariaLabel: 'Foto do vaso esmaltado' },
        { id: 'legenda', type: 'text', text: 'foto · vaso esmaltado', x: 1350, y: 880, width: 400, height: 34, color: '#F2E9D8', ...mono, fontSize: 20, transform: 'none', hidden: true },
      ],
    },
    {
      id: 'conceito', title: 'Conceito', size: S, background: '#2B1D16',
      notes: 'O conceito: o fogo transforma. Três palavras guiam tudo — forma, fogo, tempo.',
      layers: [
        { id: 'rotulo', type: 'text', text: '02 — Conceito', x: 120, y: 112, width: 800, height: 40, color: '#A88B76', ...mono },
        { id: 'frase', type: 'text', text: 'Forma que nasce do fogo.', x: 120, y: 360, width: 1300, height: 360, fontSize: 168, fontWeight: 500, letterSpacing: -7, lineHeight: 1, color: '#EEE7DB', enterAnimation: { type: 'blurIn', duration: 900 } },
        { id: 'sol', type: 'shape', shape: 'ellipse', x: 1480, y: 140, width: 300, height: 300, gradient: { type: 'radial', stops: [{ color: '#F2C14E', pos: 0 }, { color: '#B4532A', pos: 100 }] }, fill: '#B4532A', effects: { blur: 0, backdropBlur: 0, blend: 'screen', shadow: { x: 0, y: 0, blur: 120, spread: 10, color: '#B4532A99' } }, enterAnimation: { type: 'scaleIn', duration: 1200, delay: 300, easing: 'spring' } },
        { id: 'texto', type: 'text', text: 'Cada peça passa por 1.200 °C. A identidade carrega essa transformação: tons de argila crua, terracota queimada e o carvão do forno.', x: 120, y: 800, width: 1000, height: 160, fontSize: 34, fontWeight: 400, lineHeight: 1.4, color: '#A88B76' },
      ],
    },
    {
      id: 'paleta', title: 'Paleta', size: S, background: '#F4F1EC',
      layers: [
        { id: 'c1', type: 'shape', shape: 'rect', x: 0, y: 0, width: 480, height: 1080, fill: '#B4532A', enterAnimation: { type: 'slideUp', duration: 600 } },
        { id: 'c2', type: 'shape', shape: 'rect', x: 480, y: 0, width: 480, height: 1080, fill: '#EEE7DB', enterAnimation: { type: 'slideUp', duration: 600, delay: 100 } },
        { id: 'c3', type: 'shape', shape: 'rect', x: 960, y: 0, width: 480, height: 1080, fill: '#A7B29A', enterAnimation: { type: 'slideUp', duration: 600, delay: 200 } },
        { id: 'c4', type: 'shape', shape: 'rect', x: 1440, y: 0, width: 480, height: 1080, fill: '#2B1D16', enterAnimation: { type: 'slideUp', duration: 600, delay: 300 } },
        { id: 'n1', type: 'text', text: 'Terracota\n#B4532A', x: 48, y: 940, width: 400, height: 90, color: '#EEE7DB', ...mono, transform: 'none', lineHeight: 1.6 },
        { id: 'n2', type: 'text', text: 'Argila\n#EEE7DB', x: 528, y: 940, width: 400, height: 90, color: '#5B4335', ...mono, transform: 'none', lineHeight: 1.6 },
        { id: 'n3', type: 'text', text: 'Sálvia\n#A7B29A', x: 1008, y: 940, width: 400, height: 90, color: '#2E3A2C', ...mono, transform: 'none', lineHeight: 1.6 },
        { id: 'n4', type: 'text', text: 'Carvão\n#2B1D16', x: 1488, y: 940, width: 400, height: 90, color: '#EEE7DB', ...mono, transform: 'none', lineHeight: 1.6 },
      ],
    },
    {
      id: 'tipografia', title: 'Tipografia', size: S, background: '#F4F1EC',
      layers: [
        { id: 'aa', type: 'text', text: 'Aa', x: 120, y: 200, width: 700, height: 560, fontSize: 480, fontWeight: 500, letterSpacing: -20, lineHeight: 1, color: '#2B1D16' },
        { id: 'nome', type: 'text', text: 'Geist — 500 / 400', x: 120, y: 820, width: 700, height: 60, fontSize: 40, color: '#5B4335' },
        { id: 'espec', type: 'text', text: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ\nabcdefghijklmnopqrstuvwxyz\n0123456789 — & ? ! °C', x: 980, y: 300, width: 820, height: 360, fontSize: 48, lineHeight: 1.5, color: '#2B1D16' },
        { id: 'simbolo', name: 'simbolo', type: 'svg', markup: SVG_ATLAS, x: 980, y: 720, width: 220, height: 220, ariaLabel: 'Símbolo da Atlas' },
        { id: 'mono', type: 'text', text: 'Apoio: Geist Mono para legendas e códigos de cor.', x: 1240, y: 800, width: 560, height: 120, color: '#8C6A55', ...mono, transform: 'none', lineHeight: 1.5 },
      ],
    },
    {
      id: 'aplicacoes', title: 'Aplicações', size: S, background: '#EEE7DB',
      notes: 'Girar o vaso com o mouse para mostrar o esmalte. Lembrar o cliente que o 3D vem direto do Blender.',
      layers: [
        { id: 'rotulo', type: 'text', text: '05 — Aplicações', x: 120, y: 112, width: 800, height: 40, color: '#8C6A55', ...mono },
        { id: 'titulo', name: 'titulo', type: 'text', text: 'Atlas', x: 120, y: 180, width: 600, height: 170, fontSize: 160, fontWeight: 500, letterSpacing: -8, lineHeight: 1, color: '#2B1D16' },
        { id: 'foto', name: 'foto', type: 'shape', shape: 'rect', x: 120, y: 420, width: 640, height: 520, fill: '#B4532A', pattern: 'stripes', radius: 8 },
        { id: 'vaso', type: 'model3d', assetId: 'as-vaso', x: 860, y: 140, width: 940, height: 820, cameraOrbit: '30deg 72deg 105%', exposure: 1.1, rotationSpeed: 24, ariaLabel: 'Vaso esmaltado em 3D' },
        { id: 'dica', type: 'text', text: 'arraste para girar', x: 1180, y: 1020, width: 320, height: 34, color: '#8C6A55', ...mono, fontSize: 18, align: 'center' },
        { id: 'voltar', type: 'text', text: '← Capa', ariaLabel: 'Voltar à capa', x: 120, y: 980, width: 200, height: 40, fontSize: 28, color: '#5B4335', interactions: [clique({ action: 'goToScene', targetSceneId: 'capa' }, { type: 'morph', duration: 800 })] },
      ],
    },
    {
      id: 'obrigado', title: 'Obrigado', size: S, background: '#2B1D16',
      layers: [
        { id: 'pulso', type: 'lottie', assetId: 'as-pulso', x: 810, y: 240, width: 300, height: 300 },
        { id: 'obrigado', type: 'text', text: 'Obrigado.', x: 0, y: 600, width: 1920, height: 200, fontSize: 160, fontWeight: 500, letterSpacing: -8, align: 'center', color: '#EEE7DB', enterAnimation: { type: 'slideUp', duration: 700 } },
        { id: 'contato', type: 'text', text: 'estudionorte.com.br · São Paulo', x: 0, y: 840, width: 1920, height: 50, align: 'center', color: '#A88B76', ...mono, transform: 'none' },
      ],
    },
  ],
}

export const DOC_ATLAS: DocumentoProjeto = parseDocumento(ATLAS)

/** Capa padrão dos cards do painel (rótulo mono, palavra grande, forma geométrica). */
function capa(cfg: { categoria: string; palavra: string; fundo: string; tinta: string; rotulo: string; forma: 'rect' | 'ellipse' | 'semicircle' | 'arch'; corForma: string; fonte?: string; peso?: number; caixa?: 'none' | 'uppercase' }, mais: unknown[] = []) {
  const forma =
    cfg.forma === 'arch'
      ? { id: 'forma', type: 'shape', shape: 'rect', x: 1300, y: 160, width: 480, height: 560, fill: cfg.corForma, radius: 240 }
      : cfg.forma === 'rect'
        ? { id: 'forma', type: 'shape', shape: 'rect', x: 1340, y: 160, width: 440, height: 440, fill: cfg.corForma }
        : { id: 'forma', type: 'shape', shape: cfg.forma, x: 1300, y: 160, width: 480, height: 480, fill: cfg.corForma }
  return {
    id: 'capa', title: 'Capa', size: S, background: cfg.fundo,
    layers: [
      { id: 'rotulo', type: 'text', text: cfg.categoria, x: 100, y: 100, width: 900, height: 40, color: cfg.rotulo, ...mono },
      { ...forma, enterAnimation: { type: 'scaleIn', duration: 700, easing: 'spring' } },
      { id: 'palavra', name: 'titulo', type: 'text', text: cfg.palavra, x: 96, y: 680, width: 1500, height: 320, fontFamily: cfg.fonte ?? 'Geist', fontSize: 300, fontWeight: cfg.peso ?? 500, letterSpacing: -16, lineHeight: 1, color: cfg.tinta, transform: cfg.caixa ?? 'none', enterAnimation: { type: 'slideUp', duration: 700 } },
      ...mais,
    ],
  }
}

const docCapa = (mode: 'slides' | 'story' | 'explorar', cena: unknown, outras: unknown[] = []) => parseDocumento({ schemaVersion: 2, mode, scenes: [cena, ...outras] })

const DOC_MARE: DocumentoProjeto = parseDocumento({
  schemaVersion: 2,
  mode: 'story',
  scenes: [
    { id: 'st-01', title: 'Abertura', size: V, background: '#1F3B4D', layers: [
      { id: 'sol', type: 'shape', shape: 'ellipse', x: 560, y: 260, width: 400, height: 400, fill: '#E4572E' },
      { id: 'h', type: 'text', text: 'Maré', x: 80, y: 1300, width: 920, height: 300, fontSize: 280, fontWeight: 500, letterSpacing: -14, color: '#F2E9D8', interactions: [{ trigger: 'scrollThreshold', conditions: { once: true, threshold: 0.4 }, do: { action: 'animate', targetLayerId: 'h', animation: { type: 'slideUp', duration: 700 } } }] },
      { id: 'r', type: 'text', text: 'Campanha verão 2027', x: 80, y: 1640, width: 920, height: 50, color: '#F2E9D8', ...mono } ] },
    { id: 'st-02', title: 'Produto', size: V, background: '#F2E9D8', backgroundAssetId: 'as-story-2', layers: [
      { id: 'p', type: 'text', text: 'Três estampas, uma estação.', x: 100, y: 1380, width: 880, height: 220, fontSize: 84, fontWeight: 500, letterSpacing: -3, lineHeight: 1.05, color: '#F2E9D8', interactions: [{ trigger: 'scrollThreshold', conditions: { once: true, threshold: 0.5 }, do: { action: 'animate', targetLayerId: 'p', animation: { type: 'fadeIn', duration: 700 } } }] } ] },
    { id: 'st-03', title: 'Chamada', size: V, background: '#E4572E', layers: [
      { id: 'c', type: 'text', text: 'Lançamento 21.12', x: 100, y: 1560, width: 880, height: 140, fontSize: 96, fontWeight: 500, letterSpacing: -4, color: '#FFF4EC' } ] },
  ],
})

const DOC_LINHA4: DocumentoProjeto = parseDocumento({
  schemaVersion: 2,
  mode: 'explorar',
  scenes: [
    { ...capa({ categoria: 'Apresentação', palavra: 'Linha 4', fundo: '#E9E9EB', tinta: '#171717', rotulo: '#737373', forma: 'ellipse', corForma: '#5965F2' }), map: { x: 0, y: 0 } },
    { id: 'historia', title: 'História', size: S, background: '#171717', map: { x: 2400, y: -600 }, layers: [{ id: 't', type: 'text', text: 'História', x: 100, y: 700, width: 1500, height: 260, fontSize: 220, letterSpacing: -10, color: '#FAFAF9' }] },
    { id: 'numeros', title: 'Números', size: S, background: '#5965F2', map: { x: 2400, y: 900 }, layers: [{ id: 't', type: 'text', text: '+38% passageiros', x: 100, y: 700, width: 1700, height: 260, fontSize: 200, letterSpacing: -9, color: '#FFFFFF' }] },
  ],
})

const proj = (p: Omit<Projeto, 'workspaceId' | 'descricao' | 'excluidoEm' | 'criadoEm' | 'atualizadoEm'> & Partial<Projeto>): Projeto => ({
  workspaceId: WS, descricao: '', excluidoEm: null, criadoEm: '2026-10-01T10:00:00.000Z', atualizadoEm: AGORA, ...p,
})

const horasAtras = (h: number) => new Date(Date.parse(AGORA) - h * 3600_000).toISOString()

export const PROJETOS_DEMO: Projeto[] = [
  proj({ id: 'pr-atlas', nome: 'Atlas Cerâmica — Identidade', cliente: 'Atlas Cerâmica', categoria: 'Identidade visual', slug: 'atlas-ceramica', modo: 'slides', status: 'published', coverAssetId: null, revisaoAtual: 7, revisaoPublicada: 7, documento: DOC_ATLAS, atualizadoEm: horasAtras(0.2), descricao: 'Proposta de identidade: conceito, paleta, tipografia e aplicações, com o vaso em 3D.' }),
  proj({ id: 'pr-mare', nome: 'Maré — Campanha verão', cliente: 'Maré Moda Praia', categoria: 'Campanha', slug: 'mare-verao', modo: 'story', status: 'draft', coverAssetId: null, revisaoAtual: 3, revisaoPublicada: null, documento: DOC_MARE, atualizadoEm: horasAtras(3) }),
  proj({ id: 'pr-folego', nome: 'Fôlego Studio — Rebrand', categoria: 'Rebrand', slug: 'folego', modo: 'slides', status: 'published', coverAssetId: null, revisaoAtual: 4, revisaoPublicada: 4, atualizadoEm: horasAtras(26), documento: docCapa('slides', capa({ categoria: 'Rebrand', palavra: 'fôlego.', fundo: '#171717', tinta: '#D7F25C', rotulo: '#D7F25C', forma: 'rect', corForma: '#171717', peso: 600 })) }),
  proj({ id: 'pr-ipe', nome: 'Casa Ipê — Sinalização', categoria: 'Wayfinding', slug: 'casa-ipe', modo: 'slides', status: 'published', coverAssetId: null, revisaoAtual: 2, revisaoPublicada: 2, atualizadoEm: '2026-10-14T10:00:00.000Z', documento: docCapa('slides', capa({ categoria: 'Wayfinding', palavra: 'Ipê', fundo: '#F2C14E', tinta: '#2A2118', rotulo: '#5B4335', forma: 'ellipse', corForma: '#2A2118' })) }),
  proj({ id: 'pr-ruido', nome: 'Ruído Festival — Key visual', categoria: 'Key visual', slug: 'ruido', modo: 'slides', status: 'draft', coverAssetId: null, revisaoAtual: 5, revisaoPublicada: null, atualizadoEm: '2026-10-09T10:00:00.000Z', documento: docCapa('slides', capa({ categoria: 'Key visual', palavra: 'Ruído', fundo: '#E4572E', tinta: '#FFF4EC', rotulo: '#FBF0EE', forma: 'rect', corForma: '#FFF4EC', caixa: 'uppercase', peso: 600 })) }),
  proj({ id: 'pr-orvalho', nome: 'Orvalho — Embalagens', categoria: 'Packaging', slug: 'orvalho', modo: 'slides', status: 'published', coverAssetId: null, revisaoAtual: 3, revisaoPublicada: 3, atualizadoEm: '2026-10-02T10:00:00.000Z', documento: docCapa('slides', capa({ categoria: 'Packaging', palavra: 'Orvalho', fundo: '#C9D3C0', tinta: '#2E3A2C', rotulo: '#2E3A2C', forma: 'arch', corForma: '#F4F1EC' })) }),
  proj({ id: 'pr-linha4', nome: 'Linha 4 — Institucional', categoria: 'Apresentação', slug: 'linha-4', modo: 'explorar', status: 'published', coverAssetId: null, revisaoAtual: 6, revisaoPublicada: 6, atualizadoEm: '2026-09-28T10:00:00.000Z', documento: DOC_LINHA4 }),
  proj({ id: 'pr-sol', nome: 'Sol de Inverno — Editorial', categoria: 'Editorial', slug: 'sol', modo: 'slides', status: 'published', coverAssetId: null, revisaoAtual: 8, revisaoPublicada: 8, atualizadoEm: '2026-09-19T10:00:00.000Z', documento: docCapa('slides', capa({ categoria: 'Editorial', palavra: 'Sol', fundo: '#3A2E5C', tinta: '#F1D3B3', rotulo: '#F1D3B3', forma: 'ellipse', corForma: '#F1D3B3' })) }),
]

/** Token fixo de demonstração (não é segredo: só existe em modo demo). */
export const TOKEN_DEMO = 'demo_cafe_aurora_proposta_01_token_fixo_xx'

export const LINKS_DEMO: LinkCompartilhado[] = [
  { id: 'lk-1', projectId: 'pr-atlas', tokenHash: 'demo', tokenPreview: 'demo', senhaHash: null, expiraEm: null, revogadoEm: null, visualizacoes: 14, criadoEm: '2026-10-15T12:00:00.000Z', tokenDemo: TOKEN_DEMO },
  { id: 'lk-2', projectId: 'pr-atlas', tokenHash: 'demo-revogado', tokenPreview: 'r3v0', senhaHash: null, expiraEm: null, revogadoEm: '2026-10-17T12:00:00.000Z', visualizacoes: 3, criadoEm: '2026-10-10T12:00:00.000Z', tokenDemo: 'demo_link_revogado_xxxxxxxxxxxxxxxxxxxxxxx' },
  { id: 'lk-3', projectId: 'pr-ipe', tokenHash: 'demo-ipe', tokenPreview: 'ip3x', senhaHash: null, expiraEm: null, revogadoEm: null, visualizacoes: 6, criadoEm: '2026-10-14T12:00:00.000Z', tokenDemo: 'demo_casa_ipe_sinalizacao_token_fixo_xxxxx' },
  { id: 'lk-4', projectId: 'pr-orvalho', tokenHash: 'demo-orvalho', tokenPreview: 'orv4', senhaHash: null, expiraEm: null, revogadoEm: null, visualizacoes: 22, criadoEm: '2026-10-02T12:00:00.000Z', tokenDemo: 'demo_orvalho_embalagens_token_fixo_xxxxxxx' },
  { id: 'lk-5', projectId: 'pr-sol', tokenHash: 'demo-sol', tokenPreview: 's0l1', senhaHash: null, expiraEm: null, revogadoEm: null, visualizacoes: 41, criadoEm: '2026-09-19T12:00:00.000Z', tokenDemo: 'demo_sol_de_inverno_editorial_token_fixo_x' },
]

export const SNAPSHOTS_DEMO: Snapshot[] = PROJETOS_DEMO.filter((p) => p.revisaoPublicada != null).map((p) => ({ projectId: p.id, revisao: p.revisaoPublicada as number, documento: p.documento, criadoEm: p.atualizadoEm }))

export function estadoInicial(): EstadoDemo {
  return {
    versao: 2,
    usuario: { id: 'us-demo', nome: 'Marina Duarte', email: 'marina@estudionorte.com.br' },
    workspace: { id: WS, nome: 'Estúdio Norte', planoId: 'studio', estadoAssinatura: 'ativa', membros: 4 },
    projetos: structuredClone(PROJETOS_DEMO),
    assets: structuredClone(ASSETS_DEMO),
    links: structuredClone(LINKS_DEMO),
    snapshots: structuredClone(SNAPSHOTS_DEMO),
    auditoria: [],
    creditos: { saldo: 18_420, movimentos: [{ id: 'mv-1', quantidade: 20_000, motivo: 'Créditos mensais do plano Studio', criadoEm: '2026-10-01T00:00:00.000Z' }, { id: 'mv-2', quantidade: -1_580, motivo: 'Gerações de IA em outubro', criadoEm: AGORA }] },
  }
}
