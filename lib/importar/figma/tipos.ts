/**
 * Tipos (parciais e todos opcionais) da mensagem Kiwi do Figma. Os nomes vêm do schema que acompanha cada
 * cópia (ex.: `message NodeChange { ... Paint[] fillPaints = 38; ... }`); só declaramos o que usamos.
 * Tudo é opcional porque o Figma omite campos com valor padrão e o schema evolui.
 */

export interface GUID {
  sessionID?: number
  localID?: number
}
export interface Vetor {
  x?: number
  y?: number
}
export interface Matriz {
  m00?: number
  m01?: number
  m02?: number
  m10?: number
  m11?: number
  m12?: number
}
export interface CorFigma {
  r?: number
  g?: number
  b?: number
  a?: number
}
export interface Numero {
  value?: number
  units?: string
}
export interface ImagemFigma {
  hash?: Uint8Array
  name?: string
  dataBlob?: number
}
export interface Paint {
  type?: string
  color?: CorFigma
  opacity?: number
  visible?: boolean
  blendMode?: string
  stops?: { color?: CorFigma; position?: number }[]
  transform?: Matriz
  image?: ImagemFigma
  imageScaleMode?: string
  originalImageWidth?: number
  originalImageHeight?: number
}
export interface Efeito {
  type?: string
  offset?: Vetor
  radius?: number
  visible?: boolean
  blendMode?: string
  spread?: number
  color?: CorFigma
}
export interface PathFigma {
  windingRule?: string
  commandsBlob?: number
  styleID?: number
}
export interface FonteFigma {
  family?: string
  style?: string
  postscript?: string
}
export interface Baseline {
  position?: Vetor
  width?: number
  lineY?: number
  lineHeight?: number
  lineAscent?: number
  firstCharacter?: number
  endCharacter?: number
}
export interface Glifo {
  commandsBlob?: number
  position?: Vetor
  fontSize?: number
  firstCharacter?: number
  advance?: number
}
export interface DadosTextoDerivados {
  layoutSize?: Vetor
  baselines?: Baseline[]
  glyphs?: Glifo[]
  fontMetaData?: { key?: FonteFigma; fontLineHeight?: number; fontWeight?: number; fontStyle?: string }[]
  logicalIndexToCharacterOffsetMap?: number[]
}
export interface DadosTexto extends DadosTextoDerivados {
  characters?: string
  characterStyleIDs?: number[]
  styleOverrideTable?: NodeChange[]
}
export interface ArcData {
  startingAngle?: number
  endingAngle?: number
  innerRadius?: number
}
export interface ValorPropriedade {
  boolValue?: boolean
  textValue?: DadosTexto
  guidValue?: GUID
}
export interface NodeChange {
  guid?: GUID
  guidPath?: { guids?: GUID[] }
  overrideKey?: GUID
  parentIndex?: { guid?: GUID; position?: string }
  type?: string
  name?: string
  /** Em styleOverrideTable: id do estilo referenciado por characterStyleIDs. */
  styleID?: number
  visible?: boolean
  opacity?: number
  blendMode?: string
  size?: Vetor
  transform?: Matriz
  mask?: boolean
  maskType?: string
  internalOnly?: boolean
  // pintura
  fillPaints?: Paint[]
  strokePaints?: Paint[]
  strokeWeight?: number
  strokeAlign?: string
  strokeCap?: string
  strokeJoin?: string
  dashPattern?: number[]
  borderStrokeWeightsIndependent?: boolean
  borderTopWeight?: number
  borderBottomWeight?: number
  borderLeftWeight?: number
  borderRightWeight?: number
  effects?: Efeito[]
  fillGeometry?: PathFigma[]
  strokeGeometry?: PathFigma[]
  // cantos
  cornerRadius?: number
  rectangleTopLeftCornerRadius?: number
  rectangleTopRightCornerRadius?: number
  rectangleBottomLeftCornerRadius?: number
  rectangleBottomRightCornerRadius?: number
  rectangleCornerRadiiIndependent?: boolean
  /** Suavização dos cantos (0–1). */
  cornerSmoothing?: number
  // frames
  frameMaskDisabled?: boolean
  resizeToFit?: boolean
  // formas
  count?: number
  starInnerScale?: number
  arcData?: ArcData
  vectorData?: { vectorNetworkBlob?: number; normalizedSize?: Vetor }
  booleanOperation?: string
  // texto
  fontSize?: number
  fontName?: FonteFigma
  lineHeight?: Numero
  letterSpacing?: Numero
  textAlignHorizontal?: string
  textAlignVertical?: string
  textAutoResize?: string
  textCase?: string
  textDecoration?: string
  textData?: DadosTexto
  derivedTextData?: DadosTextoDerivados
  // componentes
  symbolData?: { symbolID?: GUID; symbolOverrides?: NodeChange[] }
  derivedSymbolData?: NodeChange[]
  overriddenSymbolID?: GUID
  componentPropRefs?: { defID?: GUID; componentPropNodeField?: string; isDeleted?: boolean }[]
  componentPropAssignments?: { defID?: GUID; value?: ValorPropriedade }[]
}

export interface MensagemFigma {
  type?: string
  nodeChanges?: NodeChange[]
  blobs?: { bytes?: Uint8Array }[]
  blobBaseIndex?: number
  clipboardSelectionRegions?: { parent?: GUID; nodes?: GUID[] }[]
}
