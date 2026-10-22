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

Última auditoria: out/2026 (rodada 6: máscaras de texto, imagem e SVG, tipos Alfa/Contorno/Luminância — help.figma.com não abriu deste ambiente; comportamento conferido no schema Kiwi da cópia do Figma (`mask`, `maskType` ALPHA/OUTLINE/LUMINANCE), na API de plugins (MaskType) e em material de apoio. Rodada 5: opções de texto — corte vertical, decoração, caixa, listas, parágrafos, truncar,
quebra equilibrada — e duplo clique na borda para abraçar o conteúdo. A Central de Ajuda não abriu deste ambiente;
nomes e valores conferidos no schema Kiwi que acompanha cada cópia do Figma: `leadingTrim` NONE/CAP_HEIGHT,
`textTruncation` DISABLED/ENDING + `maxLines`, `paragraphSpacing`, `textDecorationStyle` SOLID/DOTTED/WAVY,
`textDecorationThickness`, `textUnderlineOffset`, `textDecorationSkipInk`, `textDecorationFillPaints`, `textCase`
ORIGINAL/UPPER/LOWER/TITLE/SMALL_CAPS/SMALL_CAPS_FORCED, `textData.lines[].lineType` PLAIN/ORDERED_LIST/UNORDERED_LIST.
Rodada 4: traço completo, efeitos empilhados e sombra realista, cantos com cadeado e
suavização, restrições, máscara, polígono/estrela e auto layout pelo teclado). Rodada 3: depois de atalhos/ferramentas do Figma, ⌥+arrastar, cantos
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
| Constraints / redimensionamento responsivo | Esquerda/direita/esquerda e direita/centro/escala (e topo/base…) relativas ao frame pai; diagrama clicável com ⇧ para somar o lado oposto | Feito — seção "Restrições" (diagrama + dois menus) para filhos de frame livre, absolutos no auto layout e camadas soltas na tela; redimensionar o frame pai aplica as restrições; mudar o formato/tamanho da tela também (camadas sem restrição ficam onde estão, como antes) | — | `SecaoRestricoes.tsx`, `lib/scene/restricoes.ts`, `lib/editor/autolayout.ts` (`resolverCamadas`) |
| Campos numéricos: arrastar rótulo | Arrastar o ícone/letra muda o valor | Feito — Shift ×10, um único desfazer por arraste | — | `campos.tsx` (`CampoNum`) |
| Campos numéricos: setas, expressões, Esc | ↑/↓ (⇧ = 10), matemática (`100/2`), Enter/Tab confirmam, Esc cancela | Feito | — | `campos.tsx`, `lib/editor/expressao.ts` |
| Opacidade da camada | Campo % com ícone; teclas 0–9 definem opacidade com a camada selecionada | Feito — painel e teclas 1–9 = 10–90%, 0 = 100%, dois dígitos rápidos = valor exato ("5","5" = 55%), um desfazer | — | `SecaoAparencia.tsx`, `lib/editor/atalhos.ts` |
| Modo de mesclagem | Menu no título de Aparência/Camada, em grupos (escurecer, clarear, contraste, inversão, componente) | Feito — 16 modos do CSS, agrupados como no Figma | — | `SecaoAparencia.tsx` |
| Visibilidade no painel | Olho no título de Aparência | Feito (⇧⌘H também) | — | `SecaoAparencia.tsx` |
| Raio de canto | Campo com ícone; cantos independentes (4 campos) | Feito — `radii: [se, sd, id, ie]` em formas, frames, imagens, vídeo, texto (fundo), incorporados, Lottie e 3D (aditivo; `radius` guarda o maior canto); o botão abre os 4 campos na ordem do Figma (superiores em cima) com **cadeado** "cantos iguais" (editar um muda os quatro); campo único mostra "Misto"; colar do Figma traz cantos diferentes como forma | — | `SecaoAparencia.tsx`, `lib/editor/raios.ts`, `renderer/estilos.ts` |
| Suavização de cantos (squircle) | "Corner smoothing" 0–100% (60% = iOS) | Feito — `cornerSmoothing` (0–1) em retângulos, frames e imagens; curva do artigo "Desperately seeking squircles" desenhada como `clip-path: path()` (sombra externa vira `drop-shadow`); botão "iOS" = 60%; colar do Figma traz o valor | — | `lib/scene/cantos.ts`, `SecaoAparencia.tsx`, `SceneRenderer.tsx` |
| Tipografia | Fonte, peso, tamanho, entrelinha, espaçamento, alinhamento H/V, decoração, caixa, estilos de texto | Feito — inclusive largura/altura automática (Largura · Altura · Fixo; trocar o modo já grava o tamanho medido, um desfazer); sem estilos de texto | P1 (estilos de texto) | `SecoesTipo.tsx` |
| Opções de texto ("Type settings") | Botão na seção Tipografia abre um painel com abas Basics/Details: alinhamento (com justificado), decoração (nenhuma/sublinhado/tachado + estilo contínuo/pontilhado/ondulado, espessura, deslocamento, pular descendentes, cor), caixa (original, MAIÚSCULAS, minúsculas, Title, versalete, versalete forçado), vertical trim, lista (marcadores/numerada), espaço entre parágrafos, truncar com máximo de linhas; detalhes OpenType (algarismos, ligaduras) | Feito — botão "Opções de texto" (ícone de controles, fica realçado quando há algo ligado) abre o painel ao lado do inspetor com **Básico** (alinhamento, decoração + opções da linha, caixa com Primeira Maiúscula e versalete, corte vertical, lista, parágrafos, truncar + máx. de linhas) e **Detalhes** (quebra de linha automática/equilibrada/bonita — `text-wrap: balance/pretty`, algarismos tabulares, ligaduras). Tudo vale no editor, no visualizador, na exportação PNG/PDF e na medição de altura automática; campos aditivos no schema; "Copiar CSS" inclui as propriedades | P3 (lista com recuo por nível, pontuação pendurada, estilos por trecho) | `inspetor/OpcoesTexto.tsx`, `lib/scene/tipografia.ts`, `renderer/camadas/CorpoTexto.tsx` |
| Corte vertical ("Vertical trim") | Standard / "Cap height to baseline": a caixa vai da altura das maiúsculas até a linha de base, para alinhar o texto com outras camadas | Feito — `leadingTrim: 'cap'`; no navegador com `text-box: trim-both cap alphabetic` usa o corte nativo, senão margens negativas calculadas com as métricas das fontes da biblioteca (ascendente/descendente/altura das maiúsculas lidas dos arquivos; diferença < 0,5 px do nativo em todas as fontes da biblioteca). Letras passam da caixa sem cortar (como no Figma); a edição no lugar mantém as letras paradas; exportar a camada inclui a linha inteira | — | `lib/scene/tipografia.ts` (`corteVertical`), `app/globals.css` (`.texto-corte`), `lib/editor/medirTexto.ts` |
| Preenchimento: lista com +/−, olho, % | Vários preenchimentos empilhados; olho oculta; % de opacidade do preenchimento | Parcial — 1 preenchimento por camada (cor + gradiente); olho = opacidade 0 ↔ anterior; "−" deixa transparente | P2 (lista de preenchimentos no schema) | `SecaoPreenchimento.tsx` |
| Ícone de estilos ao lado de Preenchimento | Abre estilos/variáveis de cor da biblioteca | Feito — aba "Paleta" com "Estilos" do documento (aplicar, editar, excluir), paleta Mostra e cores da página; camada ligada mostra o nome do estilo e "Desvincular" | — | `SeletorCor.tsx`, `CampoCor.tsx` |
| Traço | Lista de traços (+/−, olho); cor/gradiente; posição dentro/centro/fora; espessura e espessura por lado; tracejado (traço e espaço), pontas e junções em "Mais opções" | Feito — `strokes[]` em todos os tipos com caixa e formas (até 8): dentro/centro/fora sem mudar a geometria (SVG deslocado acompanhando raios e suavização; polígonos/caminhos com recorte/máscara), por lado (retângulos, frames, mídia), contínuo/tracejado/pontilhado, pontas e junções em linhas/setas/caminhos, gradiente linear/radial; texto = contorno das letras (centro/fora). Traço antigo (`stroke/strokeWidth/dash`) aparece como um traço e só é regravado ao editar | — | `SecaoTraco.tsx`, `lib/scene/tracos.ts`, `renderer/camadas/Tracos.tsx` |
| Efeitos | Até 8 sombras projetadas e 8 internas, desfoque da camada, desfoque do fundo; olho e "−" por efeito; plugins como Beautiful Shadows geram sombras em camadas a partir de uma luz | Feito — lista `effects.shadows` (até 16, projetadas e internas, olho por linha, predefinições), desfoque da camada e do fundo com olho; **Sombra realista**: arraste a luz em volta da camada, elevação, intensidade, suavidade, camadas (1–10), cor e 4 elevações prontas — gera camadas suaves (distância dobrando até a elevação, lado oposto à luz) e regera ao mudar | P3 (ruído, textura, vidro com refração) | `SecaoEfeitos.tsx`, `lib/scene/efeitos.ts`, `lib/scene/sombrasRealistas.ts` |
| Seleção de cores mistas | "Click + to replace mixed content" | Feito — texto explicativo + "+" aplica o primeiro em todas | — | `SecaoPreenchimento.tsx` |
| Imagem: ajustes | Exposição, contraste, saturação, temperatura, tinta, realces, sombras; modo Fill/Fit/Crop/Tile | Parcial — brilho, contraste, saturação, P&B; cobrir/conter/esticar; recorte numérico; máscara (círculo/arco/triângulo) | P2 (recorte direto no canvas) | `SecoesTipo.tsx` |
| Painel de tela (nada selecionado) | Propriedades da página/frame: fundo, grades de layout, exportar | Feito — formato e W/H, preenchimento (cor, gradiente linear/radial, imagem com encaixe), transição, auto-avanço, notas, verificação | — | `InspetorTela.tsx` |
| Grades de layout | Colunas/linhas/grade por frame (⌃G mostra) | Parcial — grade de pixels global e grade de layout de 12 colunas (margem 96 / gutter 24 em 1920) na barra inferior, com encaixe nas colunas; não é por frame nem configurável | P2 | `Canvas.tsx`, `lib/editor/preencher.ts`, `GuiasCanvas.tsx` (`ColunasCanvas`) |

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
| Máscara | ⌃⌘M ("Use as mask") usa a camada de BAIXO da seleção como máscara das de cima, num "Mask group"; qualquer camada serve (forma, texto, imagem, vetor); de novo remove | Feito — ⌃⌘M (Ctrl+Alt+M) e menu de contexto: a camada de baixo (forma fechada, **texto**, **imagem** ou **SVG**; se a de baixo não servir, a mais de baixo que sirva) vira máscara das outras e dos descendentes delas, tudo num grupo; de novo (ou "−" na seção Máscara) remove; desfazer volta. A máscara não é desenhada; as recortadas ganham `mask-image` SVG no próprio quadro (posição, rotação e espelho das duas) — o mesmo renderizador no editor, visualizador, miniaturas e exportação PNG/PDF | P3 (vídeo/frame como máscara; várias máscaras empilhadas no mesmo grupo) | `lib/scene/mascara.ts`, `useEditor.ts` (`alternarMascara`), `SceneRenderer.tsx` |
| Texto como máscara | Um texto recorta a foto/gradiente/grupo acima (foto dentro das letras); continua editável | Feito — as letras vão num `<foreignObject>` com o MESMO HTML/CSS do renderizador (quebra, corte vertical, lista, truncar, caixa, decoração), então mudar texto/fonte/tamanho atualiza o recorte na hora; a fonte (biblioteca, Google Fonts, Geist) é embutida como data URL porque imagens SVG não enxergam as fontes da página (carregada sob demanda, com cache; a exportação espera). O texto-máscara fica invisível no lugar (clique duplo edita com o cursor onde clicou) | — | `lib/scene/mascara.ts` (`htmlDoTexto`), `lib/scene/mascaraRecursos.ts`, `renderer/useRecursosMascara.ts` |
| Tipo de máscara | Dropdown "Mask" no painel Design: **Alpha** (padrão; usa transparência e opacidade), **Vector** (só o contorno, opaco), **Luminance** (claro mostra, escuro esconde) | Feito — seção **Máscara** (na camada-máscara): "Alfa · Contorno · Luminância", olho para ligar/desligar (desligada = camadas inteiras), "−" remove. Alfa usa cor com alfa, gradiente, PNG/SVG transparente e opacidade da camada; contorno = silhueta opaca (caixa da imagem, letras pretas, SVG por filtro de alfa); luminância = `mask-mode: luminance`. Máscara nova é de alfa; máscaras antigas (sem tipo) seguem como contorno. Na camada recortada a seção mostra "Recortada por …" (clique seleciona a máscara). Imagens-máscara entram embutidas (reduzidas a ≤ 1600 px); enquanto carregam a camada recortada espera escondida | — | `inspetor/SecaoMascara.tsx`, `lib/scene/mascara.ts` (`tipoMascara`) |
| Máscara no painel de camadas | Ícone de máscara na camada-máscara; camadas mascaradas recuadas com seta para a máscara; olho da máscara desliga o recorte | Feito — ícone de máscara (com o tipo na dica), recortadas recuadas com seta ↳ (esmaecida com a máscara desligada); o olho da máscara vira "Ligar/Desligar máscara" | — | `PainelEsquerdo.tsx` |
| Máscara e animação | Máscara e conteúdo animam juntos no Smart Animate | Feito — a camada recortada sem animação própria toca as da máscara (entrada, saída, loop); o recorte acompanha a camada recortada | P3 (conteúdo animado por dentro com a máscara parada) | `lib/scene/mascara.ts` (`herdarAnimacoesDaMascara`) |
| Colar máscaras do Figma | `isMask` + `maskType` (ALPHA/OUTLINE/LUMINANCE) recortam os irmãos acima | Feito — em frames que viram camadas (com texto ou imagem), o nó-máscara vira camada com `isMask`/`maskType` e as camadas dos irmãos acima ganham `maskId`; frames só vetoriais continuam num SVG com `<mask>`. Máscara que vira várias camadas (texto com vários estilos, grupo) é aproximada, com aviso | — | `lib/importar/figma/converter.ts` (`filhosComMascaras`) |
| Operações booleanas | União, subtração, interseção, exclusão | Falta (os caminhos agora são editáveis — ver "Editar vetor") | P3 | — |

## 4. Ferramentas e canvas

| Recurso | Comportamento no Figma | Estado no Mostra | Prioridade | Arquivo |
|---|---|---|---|---|
| Ferramentas | V mover, K escala, F frame, R retângulo, O elipse, L linha, ⇧L seta, polígono e estrela no menu de formas, P caneta, T texto, H mão, C comentário | Feito (sem K, C) — P = caneta (pré-visualizar passou para ⌘↵) — V, F (arrastar desenha frame), R, O, L, ⇧L (arrasto do início ao fim, ⇧ = 45°), **Polígono e Estrela** no menu de formas (lados; pontas e raio interno no painel), T, H = mão (como no Figma), **S = hotspot** (antes H), espaço = mão temporária; barra com menu de formas que lembra a última | P3 (escala, comentários) | `BarraFerramentas.tsx`, `lib/editor/atalhos.ts`, `lib/scene/formas.ts`, `SecoesTipo.tsx` |
| Clique para digitar | T + clique cria caixa de texto com largura automática | Feito — clique = largura automática já em edição; arrastar = largura fixa; T sobre texto edita no ponto | — | `Canvas.tsx`, `lib/editor/medirTexto.ts` |
| Redimensionar | ⇧ mantém proporção, ⌥ a partir do centro | Feito — ⇧ proporção, ⌥ do centro, com encaixe | — | `Canvas.tsx`, `lib/editor/guias.ts` |
| Duplo clique na borda/alça | Texto: borda de cima/baixo = altura automática (mantém a largura), esquerda/direita = largura automática, canto = as duas; frame com auto layout: abraçar naquele eixo | Feito — vale na borda inteira (faixa invisível de ~8 px com cursor ↕/↔, que também redimensiona ao arrastar) e nas alças; um passo de desfazer (o tamanho medido entra junto); seleção múltipla aplica em cada texto/frame; "Redimensionar" e L/A do auto layout mostram o modo novo; espaço automático no eixo principal é desligado ao abraçar | — | `Canvas.tsx` (`abracarPelaBorda`), `lib/editor/medirTexto.ts` (`comDimensionamento`) |
| Rotacionar | Alça fora do canto; ⇧ passos de 15° | Feito (alça superior; ⇧ 15°) | — | `Canvas.tsx` |
| Mover com setas | 1 px; ⇧ 10 px (configurável) | Feito (sem configurar) | P3 | `EditorShell.tsx` |
| ⌥+arrastar duplica | Duplica enquanto arrasta | Feito — ⌥ ao começar o arraste deixa o original e arrasta a cópia (com o conteúdo de frames), um desfazer; cursor de duplicar ao segurar ⌥ sobre uma camada; parado, ⌥ continua medindo distâncias | — | `Canvas.tsx`, `useEditor.ts` (`duplicarParaArrastar`) |
| Zoom | ⌘+roda / pinça, ⇧1 ajustar tudo, ⇧2 ajustar seleção, ⌘0 100% | Feito — roda/pinça, ⇧1, ⇧2, ⌘0, +/−; origem da tela em pixel inteiro do dispositivo (sem frestas entre camadas encostadas) | — | `Canvas.tsx` |
| Editar vetor | Enter / duplo clique numa forma ou vetor: nós como círculos, alças de Bézier, barra secundária (Mover V, Laço, Caneta P, Curvar ⌘, Cortar X, Pintar ⇧B), Esc/Enter saem | Feito — duplo clique/Enter/menu "Editar vetor" em formas e SVG; primitivas viram `shape: 'path'` com `vetor` na primeira edição (elipse = 4 nós suaves, cantos arredondados = 2 nós com κ); SVG vira um vetor por cor (agrupados). Barra: Mover V (Shift soma, arrastar no vazio = área, duplo clique no segmento cria nó), Laço Q, Caneta P, Curvar B (Alt quebra simetria; clique no nó alterna canto/suave), Cortar X, Apagar E, Pintar ⇧B; setas (Shift ×10), Delete, ⌘A, um desfazer por gesto; nós encaixam em nós, camadas, tela/frações e pixel; a caixa volta a abraçar o caminho sem mover o desenho. Pintar liga/desliga o preenchimento por subcaminho (não por região da rede vetorial) | P3 (redes vetoriais com ramificações, booleanas) | `components/editor/vetor/EditorVetor.tsx`, `lib/editor/vetor/*` |
| Caneta | P: clique = canto, arrastar = curva, clicar no primeiro nó fecha, Enter/Esc termina | Feito — também dentro do modo vetor (continua de uma ponta aberta; clique num segmento cria nó) | — | `EditorVetor.tsx` |
| Preencher em grade | (não existe no Figma; inspirado no Rectangle/Snap do Windows) | Feito — menu de contexto "Preencher…", botão ao lado de W/H e ⌃⌥ + setas/↵/D F G E T/U I J K; predefinições (tela, metades, terços, quartos), grade de células para arrastar (4×4, 6×4, 12×6), "Com margens" (da grade de layout), prévia tracejada no canvas e "Dividir em grade" (C × L cópias com espaço) | — | `components/editor/PreencherGrade.tsx`, `lib/editor/preencher.ts` |
| Réguas e guias arrastáveis | ⇧R mostra réguas; arrastar cria guia | Falta — só a flag `reguas` no estado (nada é desenhado), por isso ⇧R ainda não tem atalho | P2 | `Canvas.tsx` |

## 5. Snapping e medidas

| Recurso | Comportamento no Figma | Estado no Mostra | Prioridade | Arquivo |
|---|---|---|---|---|
| Guias inteligentes | Bordas e centros de camadas vizinhas, distâncias iguais | Feito — bordas/centros das camadas, do frame pai e da tela, vãos iguais e distâncias em vermelho; limiar em px de tela | — | `lib/editor/guias.ts`, `GuiasCanvas.tsx` |
| Frações da tela | — (extra da Mostra) | Feito — ao mover/redimensionar, 1/4, 1/3, 1/2, 2/3, 3/4 da tela (e colunas da grade de layout) são alvos de encaixe com etiqueta na guia; botão na barra inferior liga/desliga; ⌘/Ctrl desliga como os demais | — | `lib/editor/preencher.ts` (`alvosDeFracao`), `lib/editor/guias.ts` (`extras`) |
| Medir distâncias | Selecionar + segurar ⌥ e passar sobre outra camada mostra distâncias em vermelho | Feito — até a camada sob o cursor, o frame pai ou a tela (só parado; arrastando com ⌥ duplica) | — | `Canvas.tsx` |
| Snap ao pixel | Snap to pixel grid (⇧⌘') | Parcial — posições inteiras ao arrastar; grade opcional | P2 | `Canvas.tsx` |
| Desligar snap temporariamente | Segurar ⌘ enquanto arrasta | Feito — ⌘/Ctrl (mover e redimensionar) | — | `Canvas.tsx` |

## 6. Auto layout

| Recurso | Comportamento no Figma | Estado no Mostra | Prioridade | Arquivo |
|---|---|---|---|---|
| Ativar auto layout | ⇧A em frame ou camadas soltas (cria frame); ícone de barras na direção do fluxo | Feito — ⇧A infere direção/gap do arranjo; ⇧⌥A remove; ícone de barras (horizontal, vertical, quebra) no painel de camadas, no botão "+" e na direção | — | `inspetor/SecaoAutoLayout.tsx`, `icones.tsx` (`IconeAutoLayout`), `lib/editor/autolayout.ts` |
| Direção, gap, padding, alinhamento 3×3 | Horizontal/vertical/quebra; gap com "auto"; padding H/V ou por lado; passar o mouse no campo destaca o espaço em rosa no canvas | Feito — direção, L/A (Abraçar/Fixo/Preencher), grade 3×3 + gap (botão de espaço automático ao lado), gap entre linhas na quebra, padding H/V com botão "por lado" (abre sozinho quando os lados diferem), "Recortar conteúdo"; hover/foco nos campos de gap/padding destaca a área no canvas | — | `SecaoAutoLayout.tsx`, `Canvas.tsx`, `lib/editor/autolayout.ts` (`areasDeEspaco`) |
| Hug / Fill / Fixed + ordem dos filhos | Por eixo, em pais e filhos; com um filho selecionado, ← → (horizontal) / ↑ ↓ (vertical) trocam a ordem entre os irmãos | Feito — rótulo "Hug"/"Fill" no tamanho do canvas; arrastar um filho reordena com linha azul; **setas na direção do fluxo reordenam** (bloco de vários itens anda junto; na quebra as quatro setas andam pela ordem; a seta perpendicular não faz nada, como no Figma); seção "No auto layout" mostra "2 de 3" com botões antes/depois | — | `EditorShell.tsx`, `SecaoAutoLayout.tsx`, `lib/editor/autolayout.ts` (`passoDaSeta`, `moverNoFluxo`) |
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
| Colar do Figma | Buffer próprio do Figma (não legível pelo navegador) | Feito — o HTML fig-kiwi do Figma é decodificado: frames, retângulos/elipses (com cantos independentes e suavização), textos (com contorno das letras, vertical trim, tachado e estilo/espessura/deslocamento/cor do sublinhado, Title/versalete, listas, espaço entre parágrafos, truncar/máx. de linhas, algarismos tabulares e ligaduras), imagens, gradientes; **traços** (vários, dentro/centro/fora, por lado, tracejado, pontas) e **sombras** (várias, internas) vão para os campos novos em vez de virar SVG; polígonos e estrelas simples viram formas editáveis; 16 modos de mesclagem; vetores viram SVG, que vira caminho editável ao entrar em "Editar vetor" | P3 (VECTOR direto para `vetor`, auto layout do Figma) | `lib/importar/figma/*`, `lib/editor/vetor/svgVetor.ts` |
| Colar imagem/arquivo | Imagem vira preenchimento de retângulo | Feito (imagem, SVG, GLB, Lottie, links de embed) | — | `lib/editor/importar.ts` |

## 11. Atalhos — resumo do que falta

| Atalho Figma | Ação | Mostra hoje | Prioridade |
|---|---|---|---|
| ⌥A / ⌥D / ⌥H / ⌥W / ⌥S / ⌥V | Alinhar | Feito | — |
| ⇧H / ⇧V | Espelhar | Feito | — |
| 0–9 | Opacidade 100%/10%…90% | Feito (dois dígitos) | — |
| F R O L ⇧L P T H | Ferramentas | Feito (H = mão; hotspot em S; P = caneta) | — |
| Enter (forma/vetor) | Editar vetor | Feito (também duplo clique) | — |
| ⌥ + arrastar | Duplicar | Feito | — |
| ⇧A | Auto layout | Feito | — |
| ⌃⌘M | Usar como máscara | Feito (também Ctrl+Alt+M) | — |
| ← → / ↑ ↓ (filho de auto layout) | Reordenar no fluxo | Feito | — |
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
  e `colorStyleIds` nas camadas; `shape: 'path'` + `vetor: { w, h, caminhos: [{ nos: [{ x, y, entrada?, saida?,
  tipo: 'canto' | 'suave' }], fechado, semPreenchimento? }], fillRule }` (coordenadas locais num quadro w × h que o
  renderizador escala para a camada; alças em posição absoluta). Matemática pura e testada em `lib/editor/vetor/`
  (de Casteljau, caixa exata pelas derivadas, laço, `d` do SVG com arcos/quadráticas). Rodada 4 (aditivo, sem migração): `strokes[]` (traços), `effects.shadows[]` com `inner`/`hidden`/`realistic`,
  `effects.realistic` (ajustes da sombra realista), `blurHidden`/`backdropBlurHidden`, `cornerSmoothing`, `constraints`,
  `maskId`/`isMask`, `shape: 'polygon'` com `count`, estrela com `count`/`ratio`, `radii` em vídeo/texto/incorporado/Lottie/3D e
  7 modos de mesclagem novos. Documentos antigos desenham igual: o traço antigo só é convertido ao editar e a sombra única
  continua valendo enquanto não há lista. Ainda pedem schema: vários preenchimentos, gradiente angular/diamante,
  travar proporção persistente. Rodada 5 (aditivo, sem migração) em textos: `strikethrough`, `decorationStyle`,
  `decorationThickness`, `decorationOffset`, `decorationSkipInk`, `decorationColor`, `leadingTrim: 'none' | 'cap'`,
  `listStyle`, `paragraphSpacing`, `truncate` + `maxLines`, `textWrap`, `tabularNums`, `ligatures` e `transform` com
  `capitalize`/`smallCaps`/`allSmallCaps`. Regras num só lugar (`lib/scene/tipografia.ts`), usadas pelo renderizador
  e pelo medidor de altura/largura automática; sem nenhum campo novo o DOM do texto é o de antes.

## Editor no celular e tablet

- Abaixo de 1024 px o painel de propriedades vira gaveta (botão na barra flutuante do canvas); abaixo de
  768 px o painel de telas/camadas também, e as ferramentas vão para a barra flutuante.
- Cabeçalho sem rolagem horizontal em 390 px: símbolo (→ Início), nome, menu ⋯ (desfazer/refazer,
  pré-visualizar, apresentar do início, visão do apresentador, exportar, detalhes do projeto, atalhos),
  Apresentar (ícone) e Compartilhar. Avatar com as iniciais do usuário.
