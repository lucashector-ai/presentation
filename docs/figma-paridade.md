# Paridade com o Figma — auditoria e backlog

Objetivo: quem vem do Figma deve se sentir em casa no editor da Mostra — mesmo modelo mental, mesmos
atalhos, mesma precisão — com a identidade visual da Mostra (tokens de `app/globals.css`, Geist, acento
`#5965F2`). Copiamos **comportamento**, não marca.

Fontes: Central de Ajuda do Figma (help.figma.com), consultada em out/2026 — artigos "Adjust alignment,
rotation, position, and dimensions", "Update fills using the color picker", "Use gradients as a fill or
stroke", "Apply effects to layers", "Apply and adjust stroke properties", "Select layers and objects",
"Measure distances between layers", "Set small and big nudge values", "Toggle on auto layout in designs",
"Guide to components in Figma", "Create and use variants", "Export formats and settings", "Export static
designs from Figma", "Smart animate layers between frames", "Use Figma products with a keyboard".
Atalhos escritos no padrão Mac (⌘ = Ctrl, ⌥ = Alt no Windows).

**Estado:** Feito · Parcial · Falta · Fora (não faz sentido num editor de apresentações).
**Prioridade:** P0 (próximo ciclo) · P1 (importante) · P2 (desejável) · P3 (talvez nunca).

Última auditoria: out/2026 (rodada 3), depois de atalhos/ferramentas do Figma, ⌥+arrastar, cantos
independentes, estilos de cor, exportação PNG/JPG/PDF e editor no celular — conferindo no código o que
outras frentes entregaram (encaixe com espaçamento igual e distâncias em vermelho, ⌥ para medir, ⌘ sem
encaixe, ⌥ redimensiona do centro, frames + auto layout, Enter/⇧Enter, ⌘+clique, clique para digitar,
colar do Figma).

---

## 1. Painel Design (propriedades)

| Recurso | Comportamento no Figma | Estado no Mostra | Prioridade | Arquivo |
|---|---|---|---|---|
| Estrutura em seções | Posição · Layout · Aparência · Tipografia · Preenchimento · Traço · Efeitos · Exportar; seções vazias recolhidas só com título e "+" | Feito — mesma ordem; Traço/Efeitos/Exportar/Recorte/Ajustes/Fundo da caixa vazios ficam recolhidos com "+", e "−" remove | — | `inspetor/AbaDesign.tsx`, `controles.tsx` (`Secao`) |
| Cabeçalho com tipo da camada | Nome do tipo ("Retângulo") com menu para trocar; ações à direita | Feito — tipo, troca de forma pelo título (▾), nome da camada, trazer para frente/enviar para trás, duplicar, excluir; seleção múltipla: agrupar/desagrupar | — | `CabecalhoCamada.tsx` |
| Alinhamento (6 botões) | Esquerda/centro/direita, topo/meio/base; com 1 camada alinha ao frame pai | Feito — com 1 camada alinha à tela; distribuir aparece com 3+ camadas | — | `SecaoPosicao.tsx` |
| Atalhos de alinhamento | ⌥A ⌥H ⌥D ⌥W ⌥V ⌥S | Feito — pela tecla física (`code`), funciona com ⌥ no Mac | — | `lib/editor/atalhos.ts`, `EditorShell.tsx` |
| Tidy up / distribuir espaçamento | Distribuir com espaço igual; "Tidy up" organiza em grade (⌃⌥T) | Parcial — distribuir H/V; sem tidy up nem campo de espaçamento | P2 | `lib/editor/guias.ts` |
| X / Y | Campos com letra dentro; múltipla seleção mostra "Mixed" | Feito — "Misto", valor digitado vale para todas; ↑/↓ e arraste somam em cada uma | — | `SecaoPosicao.tsx`, `campos.tsx` |
| Rotação | Campo com ícone de ângulo, girar 90°, espelhar H/V (⇧H / ⇧V) | Feito — painel (ângulo normalizado em −180…180) e ⇧H/⇧V | — | `SecaoPosicao.tsx`, `lib/editor/atalhos.ts` |
| W / H + travar proporção | Cadeado de proporção ao lado de W/H | Feito — trava por camada (padrão ligado para imagem, SVG, 3D, Lottie), vale também em seleção múltipla; lembrado só na sessão | P2 (persistir no schema) | `SecaoLayout.tsx` |
| Constraints / redimensionamento responsivo | Esquerda/direita/centro/escala relativas ao frame | Fora — telas escalam inteiras; há "Responsivo › Ocultar no celular / ajuste" | P3 | `SecoesMostra.tsx` |
| Campos numéricos: arrastar rótulo | Arrastar o ícone/letra muda o valor | Feito — Shift ×10, um único desfazer por arraste | — | `campos.tsx` (`CampoNum`) |
| Campos numéricos: setas, expressões, Esc | ↑/↓ (⇧ = 10), matemática (`100/2`), Enter/Tab confirmam, Esc cancela | Feito | — | `campos.tsx`, `lib/editor/expressao.ts` |
| Opacidade da camada | Campo % com ícone; teclas 0–9 definem opacidade com a camada selecionada | Feito — painel e teclas 1–9 = 10–90%, 0 = 100%, dois dígitos rápidos = valor exato ("5","5" = 55%), um desfazer | — | `SecaoAparencia.tsx`, `lib/editor/atalhos.ts` |
| Modo de mesclagem | Menu no título de Aparência/Camada | Feito (9 modos) | — | `SecaoAparencia.tsx` |
| Visibilidade no painel | Olho no título de Aparência | Feito (⇧⌘H também) | — | `SecaoAparencia.tsx` |
| Raio de canto | Campo com ícone; cantos independentes (4 campos) | Feito — `radii: [se, sd, id, ie]` em formas, frames e imagens (aditivo; `radius` guarda o maior canto para renderizadores antigos); o botão abre 4 campos; campo único mostra "Misto"; colar do Figma traz cantos diferentes como forma (antes virava SVG) | — | `SecaoAparencia.tsx`, `lib/editor/raios.ts`, `lib/scene/schema.ts`, `renderer/estilos.ts` |
| Suavização de cantos (squircle) | "Corner smoothing" 0–100% | Falta | P3 | — |
| Tipografia | Fonte, peso, tamanho, entrelinha, espaçamento, alinhamento H/V, decoração, caixa, estilos de texto | Feito — inclusive largura/altura automática (Largura · Altura · Fixo); sem estilos de texto, truncar e listas | P1 (estilos de texto) | `SecoesTipo.tsx` |
| Preenchimento: lista com +/−, olho, % | Vários preenchimentos empilhados; olho oculta; % de opacidade do preenchimento | Parcial — 1 preenchimento por camada (cor + gradiente); olho = opacidade 0 ↔ anterior; "−" deixa transparente | P2 (lista de preenchimentos no schema) | `SecaoPreenchimento.tsx` |
| Ícone de estilos ao lado de Preenchimento | Abre estilos/variáveis de cor da biblioteca | Feito — aba "Paleta" com "Estilos" do documento (aplicar, editar, excluir), paleta Mostra e cores da página; camada ligada mostra o nome do estilo e "Desvincular" | — | `SeletorCor.tsx`, `CampoCor.tsx` |
| Traço | Cor, espessura, posição (dentro/centro/fora), tracejado, pontas, por lado | Parcial — cor (com alfa), espessura e tracejado em formas; sem posição/pontas/lados; texto e imagem sem traço | P2 | `SecaoPreenchimento.tsx` (`SecaoTraco`) |
| Efeitos | Até 8 sombras projetadas e 8 internas, desfoque da camada, desfoque do fundo, ruído, textura, vidro | Parcial — 1 sombra projetada (predefinições + X/Y/desfoque/expansão/cor), desfoque da camada, desfoque do fundo | P2 (sombra interna, várias sombras) | `SecaoEfeitos.tsx` |
| Seleção de cores mistas | "Click + to replace mixed content" | Feito — texto explicativo + "+" aplica o primeiro em todas | — | `SecaoPreenchimento.tsx` |
| Imagem: ajustes | Exposição, contraste, saturação, temperatura, tinta, realces, sombras; modo Fill/Fit/Crop/Tile | Parcial — brilho, contraste, saturação, P&B; cobrir/conter/esticar; recorte numérico; máscara (círculo/arco/triângulo) | P2 (recorte direto no canvas) | `SecoesTipo.tsx` |
| Painel de tela (nada selecionado) | Propriedades da página/frame: fundo, grades de layout, exportar | Feito — formato e W/H, preenchimento (cor, gradiente linear/radial, imagem com encaixe), transição, auto-avanço, notas, verificação | — | `InspetorTela.tsx` |
| Grades de layout | Colunas/linhas/grade por frame (⌃G mostra) | Parcial — grade global no canvas (botão na barra inferior) | P2 | `Canvas.tsx` |

## 2. Seletor de cor

| Recurso | Comportamento no Figma | Estado no Mostra | Prioridade | Arquivo |
|---|---|---|---|---|
| Abrir pela amostra | Clique na amostra abre o seletor ao lado do painel | Feito — popover ao lado do campo, sem sair da janela; Esc/clique fora fecham, foco volta ao campo | — | `CampoCor.tsx`, `SeletorCor.tsx` |
| Abas Personalizado / Bibliotecas | Personalizado e estilos/variáveis da biblioteca | Feito como Personalizado / Paleta (paleta Mostra + "Nesta página") | — | `SeletorCor.tsx` |
| Tipos de pintura | Sólido, gradiente linear, radial, angular, diamante, imagem, vídeo, padrão | Parcial — sólido, linear, radial (texto, forma, fundo da tela) e imagem (fundo da tela); angular aparece desativado | P2 (angular/diamante: schema + `gradienteCss`) | `SeletorCor.tsx`, `lib/scene/schema.ts` |
| Área saturação × brilho, matiz, alfa | Arrastar; alfa sobre xadrez | Feito — também por teclado (setas, Shift ×10), um único desfazer por arraste | — | `SeletorCor.tsx` |
| Conta-gotas | Ícone no seletor; atalho I / ⌃C; só amostra fora do canvas no app desktop | Feito com a EyeDropper API (Chrome/Edge); some onde não existe · Falta atalho I | P2 | `SeletorCor.tsx` |
| Modelos de cor | Hex, RGB, CSS, HSL, HSB + % | Feito — HEX/RGB/HSL/HSB + %; campo hex aceita colar `rgb()`, `hsl()`, `#RGBA` | — | `SeletorCor.tsx`, `lib/editor/cor.ts` |
| Cores do documento | "On this page" com cores usadas | Feito — "Nesta página" (sem repetir, todas as telas) | — | `lib/editor/cor.ts` (`coresUsadas`) |
| Editor de gradiente | Paradas na barra: clique adiciona, arrastar move, Delete remove; "+" e "−" nas paradas; alças no canvas para direção | Feito na barra (clique, arraste, Backspace/Delete, setas, inverter, ângulo) · Falta alças no canvas | P2 | `SeletorCor.tsx` |
| Salvar como estilo | Criar estilo de cor a partir do seletor | Feito — "Salvar como estilo" (com nome) cria em `theme.colorStyles` e liga a camada (`colorStyleIds`); editar o estilo atualiza todas as camadas ligadas em todas as telas; editar a cor direto solta o estilo | — | `SeletorCor.tsx`, `lib/editor/estilosCor.ts` |

## 3. Seleção e camadas

| Recurso | Comportamento no Figma | Estado no Mostra | Prioridade | Arquivo |
|---|---|---|---|---|
| Clique, Shift+clique, laço | Seleção somada com ⇧; laço por área | Feito | — | `Canvas.tsx` |
| Selecionar tudo | ⌘A | Feito (ignora travadas/ocultas) | — | `EditorShell.tsx` |
| Seleção profunda | ⌘+clique seleciona camada dentro de grupo/frame; Enter / ⇧Enter descem/sobem na hierarquia | Feito — ⌘+clique, duplo clique desce um nível, Enter/⇧Enter (frames com `parentId`) | — | `Canvas.tsx`, `lib/scene/arvore.ts` |
| Selecionar semelhantes | ⌥⌘A camadas iguais; Editar › Selecionar mesmo preenchimento/traço/fonte | Falta | P2 | — |
| Intervalo no painel de camadas | Shift+clique seleciona o intervalo | Parcial (Shift soma, não seleciona intervalo) | P2 | `PainelEsquerdo.tsx` |
| Renomear camada | Duplo clique no painel; ⌘R | Parcial — duplo clique e campo no cabeçalho do painel Design; sem ⌘R | P2 | `PainelEsquerdo.tsx`, `CabecalhoCamada.tsx` |
| Travar / ocultar | ⇧⌘L / ⇧⌘H | Feito — ⇧⌘L (e ⌘L) e ⇧⌘H | — | `EditorShell.tsx` |
| Ordem | ⌘] / ⌘[ um passo, ⌥⌘] / ⌥⌘[ frente/trás | Feito — ⌘]/⌘[ e ⌥⌘]/⌥⌘[ como no Figma; `]`/`[` e ⇧]/⇧[ continuam | — | `EditorShell.tsx` |
| Agrupar / frames | ⌘G, ⇧⌘G; ⌥⌘G cria frame | Feito — grupos planos, frames aninhados (`parentId`), ⌥⌘G envolve em frame, ⇧⌘G desfaz; ferramenta F desenha frame | — | `useEditor.ts` |
| Máscara | ⌃⌘M usa a camada de baixo como máscara | Parcial — máscara de forma só em imagem | P3 | `SecoesTipo.tsx` |
| Operações booleanas | União, subtração, interseção, exclusão | Fora (camadas vetoriais vêm prontas como SVG) | P3 | — |

## 4. Ferramentas e canvas

| Recurso | Comportamento no Figma | Estado no Mostra | Prioridade | Arquivo |
|---|---|---|---|---|
| Ferramentas | V mover, K escala, F frame, R retângulo, O elipse, L linha, ⇧L seta, P caneta, T texto, H mão, C comentário | Feito (sem K, P, C) — V, F (arrastar desenha frame), R, O, L, ⇧L (arrasto do início ao fim, ⇧ = 45°), T, H = mão (como no Figma), **S = hotspot** (antes H), espaço = mão temporária; barra com menu de formas que lembra a última | P3 (caneta, escala, comentários) | `BarraFerramentas.tsx`, `lib/editor/atalhos.ts`, `Canvas.tsx` |
| Clique para digitar | T + clique cria caixa de texto com largura automática | Feito — clique = largura automática já em edição; arrastar = largura fixa; T sobre texto edita no ponto | — | `Canvas.tsx`, `lib/editor/medirTexto.ts` |
| Redimensionar | ⇧ mantém proporção, ⌥ a partir do centro | Feito — ⇧ proporção, ⌥ do centro, com encaixe | — | `Canvas.tsx`, `lib/editor/guias.ts` |
| Rotacionar | Alça fora do canto; ⇧ passos de 15° | Feito (alça superior; ⇧ 15°) | — | `Canvas.tsx` |
| Mover com setas | 1 px; ⇧ 10 px (configurável) | Feito (sem configurar) | P3 | `EditorShell.tsx` |
| ⌥+arrastar duplica | Duplica enquanto arrasta | Feito — ⌥ ao começar o arraste deixa o original e arrasta a cópia (com o conteúdo de frames), um desfazer; cursor de duplicar ao segurar ⌥ sobre uma camada; parado, ⌥ continua medindo distâncias | — | `Canvas.tsx`, `useEditor.ts` (`duplicarParaArrastar`) |
| Zoom | ⌘+roda / pinça, ⇧1 ajustar tudo, ⇧2 ajustar seleção, ⌘0 100% | Feito — roda/pinça, ⇧1, ⇧2, ⌘0, +/−; origem da tela em pixel inteiro do dispositivo (sem frestas entre camadas encostadas) | — | `Canvas.tsx` |
| Réguas e guias arrastáveis | ⇧R mostra réguas; arrastar cria guia | Falta — só a flag `reguas` no estado (nada é desenhado), por isso ⇧R ainda não tem atalho | P2 | `Canvas.tsx` |

## 5. Snapping e medidas

| Recurso | Comportamento no Figma | Estado no Mostra | Prioridade | Arquivo |
|---|---|---|---|---|
| Guias inteligentes | Bordas e centros de camadas vizinhas, distâncias iguais | Feito — bordas/centros das camadas, do frame pai e da tela, vãos iguais e distâncias em vermelho; limiar em px de tela | — | `lib/editor/guias.ts`, `GuiasCanvas.tsx` |
| Medir distâncias | Selecionar + segurar ⌥ e passar sobre outra camada mostra distâncias em vermelho | Feito — até a camada sob o cursor, o frame pai ou a tela (só parado; arrastando com ⌥ duplica) | — | `Canvas.tsx` |
| Snap ao pixel | Snap to pixel grid (⇧⌘') | Parcial — posições inteiras ao arrastar; grade opcional | P2 | `Canvas.tsx` |
| Desligar snap temporariamente | Segurar ⌘ enquanto arrasta | Feito — ⌘/Ctrl (mover e redimensionar) | — | `Canvas.tsx` |

## 6. Auto layout

| Recurso | Comportamento no Figma | Estado no Mostra | Prioridade | Arquivo |
|---|---|---|---|---|
| Ativar auto layout | ⇧A em frame ou camadas soltas (cria frame) | Feito — ⇧A infere direção/gap do arranjo; ⇧⌥A remove | — | `inspetor/SecaoAutoLayout.tsx`, `lib/editor/autolayout.ts` |
| Direção, gap, padding, alinhamento 3×3 | Horizontal/vertical/quebra; gap; padding por lado (⌘+clique abre os 4) | Feito — inclusive quebra (wrap) com gap de linha e espaço automático | — | `SecaoAutoLayout.tsx` |
| Hug / Fill / Fixed | Por eixo, em pais e filhos | Feito — rótulo "Hug"/"Fill" no tamanho do canvas; arrastar um filho reordena com linha azul | — | `SecaoAutoLayout.tsx`, `Canvas.tsx` |
| Wrap, mín./máx., posição absoluta | Quebra com gap H/V; limites; filho ignorando o fluxo | Parcial — wrap e posição absoluta; sem mín./máx. | P2 | `lib/editor/autolayout.ts` |

## 7. Componentes, estilos e variáveis

| Recurso | Comportamento no Figma | Estado no Mostra | Prioridade | Arquivo |
|---|---|---|---|---|
| Componentes e instâncias | ⌥⌘K cria componente; instâncias com overrides preservados | Falta (há "Blocos" prontos que inserem cópias) | P1 | `PainelEsquerdo.tsx` |
| Variantes e propriedades | Conjuntos de variantes; propriedades booleanas/texto/troca | Falta | P3 | — |
| Estilos de cor/texto/efeito | Estilos locais e de biblioteca aplicados pelo ícone de estilos | Parcial — estilos de cor nomeados (preenchimento, cor do texto, traço); sem estilos de texto/efeito | P1 (estilos de texto) | `lib/editor/estilosCor.ts`, `SeletorCor.tsx` |
| Variáveis e modos | Cor/número/texto/booleano, modos claro/escuro | Falta | P3 | — |
| Copiar/colar propriedades | ⌥⌘C / ⌥⌘V | Feito ("Copiar estilo"/"Colar estilo") | — | `useEditor.ts` |

## 8. Protótipo e apresentação

| Recurso | Comportamento no Figma | Estado no Mostra | Prioridade | Arquivo |
|---|---|---|---|---|
| Interações | Gatilho (clique, hover, pressionar, arrastar, atraso, tecla) → ação (navegar, overlay, rolar, voltar, link, variável) | Parcial — clique, hover, entrar na tela, scroll → próxima/anterior/ir para tela/link/mostrar-ocultar/vídeo/animar | P2 (overlays, tecla) | `AbaInteracoes.tsx` |
| Smart animate | Anima camadas com o mesmo nome entre frames | Feito como transição "Morph" | — | `components/renderer/*` |
| Curvas de animação | Ease in/out, spring, bezier personalizada | Parcial — predefinições + spring (aba Animação, outra frente) | P1 | `AbaAnimacao.tsx` |
| Fluxos e ponto inicial | Vários fluxos com ponto de partida | Parcial — modo Explorar com mapa | P3 | — |
| Apresentar | Modo apresentação com notas | Feito (apresentar, visão do apresentador) | — | `app/app/projects/*` |

## 9. Exportar

| Recurso | Comportamento no Figma | Estado no Mostra | Prioridade | Arquivo |
|---|---|---|---|---|
| Configurações de exportação | PNG/JPG/SVG/PDF; escala (2x, largura/altura fixas); sufixo; várias por camada | Feito (sem largura fixa, sufixo e várias por camada) — seleção em PNG/JPG 1×/2×/3× na seção "Exportar" (PNG com fundo transparente); tela atual e PDF da apresentação (uma página por tela) no menu ⋯; usa o mesmo renderizador DOM, com fontes e imagens; 3D/incorporados saem com pôster/placeholder | P3 (SVG, várias configurações) | `SecaoExportar.tsx`, `MenuEditor.tsx`, `lib/exportar/*` |
| Copiar como PNG / SVG | ⇧⌘C copia PNG; menu Copiar como SVG | Parcial — "Copiar como PNG" (menu ⋯ e ⇧⌘C quando o navegador não reserva o atalho); sem SVG | P2 | `useExportar.ts` |
| Copiar como CSS | Dev Mode / inspecionar mostra CSS | Feito ("Copiar CSS") | — | `SecaoExportar.tsx` |

## 10. Área de transferência

| Recurso | Comportamento no Figma | Estado no Mostra | Prioridade | Arquivo |
|---|---|---|---|---|
| Copiar/colar/recortar/duplicar | ⌘C ⌘V ⌘X ⌘D; colar mantém posição se houver espaço | Feito (desloca 24 px se sobrepuser) | — | `useEditor.ts`, `MenuContexto.tsx` |
| Colar sobre a seleção / substituir | ⇧⌘V cola por cima; ⇧⌘R substitui | Falta | P2 | — |
| Colar do Figma | Buffer próprio do Figma (não legível pelo navegador) | Feito — o HTML fig-kiwi do Figma é decodificado: frames, retângulos/elipses (com cantos independentes), textos, imagens, gradientes, sombras; vetores viram SVG | — | `lib/importar/figma/*` |
| Colar imagem/arquivo | Imagem vira preenchimento de retângulo | Feito (imagem, SVG, GLB, Lottie, links de embed) | — | `lib/editor/importar.ts` |

## 11. Atalhos — resumo do que falta

| Atalho Figma | Ação | Mostra hoje | Prioridade |
|---|---|---|---|
| ⌥A / ⌥D / ⌥H / ⌥W / ⌥S / ⌥V | Alinhar | Feito | — |
| ⇧H / ⇧V | Espelhar | Feito | — |
| 0–9 | Opacidade 100%/10%…90% | Feito (dois dígitos) | — |
| F R O L ⇧L T H | Ferramentas | Feito (H = mão; hotspot em S) | — |
| ⌥ + arrastar | Duplicar | Feito | — |
| ⇧A | Auto layout | Feito | — |
| ⌥⌘K | Criar componente | — | P1 |
| ⌘R | Renomear | — | P2 |
| ⇧2 | Zoom na seleção | Feito | — |
| ⌘] / ⌘[ | Um passo à frente/atrás | Feito (também ⌥⌘] / ⌥⌘[) | — |
| ⇧⌘L | Travar | Feito | — |
| ⇧R | Réguas | — (sem réguas) | P2 |
| I | Conta-gotas | só no seletor | P2 |
| ⌃⌥T | Tidy up | — | P2 |
| ⇧⌘C | Copiar como PNG | Feito (também no menu ⋯) | — |
| ⌃⇧? | Painel de atalhos | `?` | — |

---

## Notas de implementação (painel Design e seletor de cor)

- **Gestos com um único desfazer:** `ProvedorInspetor` (`inspetor/contexto.tsx`) guarda o documento no
  início de um arraste (rótulo de campo, área de cor, faixas, paradas, deslizantes) e registra uma única
  entrada no histórico ao soltar. Seções usam `useCamadas(editor).set/setFn`, que gravam sem histórico
  durante o gesto.
- **Seções plugáveis:** `AbaDesign.tsx` é só uma lista; cada `SecaoX({ editor, assets })` decide se aparece.
- **Matemática de cor pura** em `lib/editor/cor.ts` (testes em `cor.test.ts`).
- **Mudanças de schema (aditivas, sem migração):** `radii` em formas/frames/imagens; `theme.colorStyles`
  e `colorStyleIds` nas camadas. Ainda pedem schema: vários preenchimentos/sombras, gradiente
  angular/diamante, travar proporção persistente, posição do traço.

## Editor no celular e tablet

- Abaixo de 1024 px o painel de propriedades vira gaveta (botão na barra flutuante do canvas); abaixo de
  768 px o painel de telas/camadas também, e as ferramentas vão para a barra flutuante.
- Cabeçalho sem rolagem horizontal em 390 px: símbolo (→ Início), nome, menu ⋯ (desfazer/refazer,
  pré-visualizar, apresentar do início, visão do apresentador, exportar, detalhes do projeto, atalhos),
  Apresentar (ícone) e Compartilhar. Avatar com as iniciais do usuário.
