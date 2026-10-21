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

Última auditoria: out/2026, depois do redesenho do painel Design e do seletor de cor
(`components/editor/inspetor/*`, `lib/editor/cor.ts`). Outras frentes em andamento em paralelo (colar do
Figma, snapping/clique-para-digitar/auto layout, aba Animação, visualizador) — atualize as linhas delas
quando forem integradas.

---

## 1. Painel Design (propriedades)

| Recurso | Comportamento no Figma | Estado no Mostra | Prioridade | Arquivo |
|---|---|---|---|---|
| Estrutura em seções | Posição · Layout · Aparência · Tipografia · Preenchimento · Traço · Efeitos · Exportar; seções vazias recolhidas só com título e "+" | Feito — mesma ordem; Traço/Efeitos/Exportar/Recorte/Ajustes/Fundo da caixa vazios ficam recolhidos com "+", e "−" remove | — | `inspetor/AbaDesign.tsx`, `controles.tsx` (`Secao`) |
| Cabeçalho com tipo da camada | Nome do tipo ("Retângulo") com menu para trocar; ações à direita | Feito — tipo, troca de forma pelo título (▾), nome da camada, trazer para frente/enviar para trás, duplicar, excluir; seleção múltipla: agrupar/desagrupar | — | `CabecalhoCamada.tsx` |
| Alinhamento (6 botões) | Esquerda/centro/direita, topo/meio/base; com 1 camada alinha ao frame pai | Feito — com 1 camada alinha à tela; distribuir aparece com 3+ camadas | — | `SecaoPosicao.tsx` |
| Atalhos de alinhamento | ⌥A ⌥H ⌥D ⌥W ⌥V ⌥S | Falta | P1 | `EditorShell.tsx` |
| Tidy up / distribuir espaçamento | Distribuir com espaço igual; "Tidy up" organiza em grade (⌃⌥T) | Parcial — distribuir H/V; sem tidy up nem campo de espaçamento | P2 | `lib/editor/guias.ts` |
| X / Y | Campos com letra dentro; múltipla seleção mostra "Mixed" | Feito — "Misto", valor digitado vale para todas; ↑/↓ e arraste somam em cada uma | — | `SecaoPosicao.tsx`, `campos.tsx` |
| Rotação | Campo com ícone de ângulo, girar 90°, espelhar H/V (⇧H / ⇧V) | Feito no painel (ângulo normalizado em −180…180) · Falta ⇧H/⇧V | P1 (atalhos) | `SecaoPosicao.tsx` |
| W / H + travar proporção | Cadeado de proporção ao lado de W/H | Feito — trava por camada (padrão ligado para imagem, SVG, 3D, Lottie), vale também em seleção múltipla; lembrado só na sessão | P2 (persistir no schema) | `SecaoLayout.tsx` |
| Constraints / redimensionamento responsivo | Esquerda/direita/centro/escala relativas ao frame | Fora — telas escalam inteiras; há "Responsivo › Ocultar no celular / ajuste" | P3 | `SecoesMostra.tsx` |
| Campos numéricos: arrastar rótulo | Arrastar o ícone/letra muda o valor | Feito — Shift ×10, um único desfazer por arraste | — | `campos.tsx` (`CampoNum`) |
| Campos numéricos: setas, expressões, Esc | ↑/↓ (⇧ = 10), matemática (`100/2`), Enter/Tab confirmam, Esc cancela | Feito | — | `campos.tsx`, `lib/editor/expressao.ts` |
| Opacidade da camada | Campo % com ícone; teclas 0–9 definem opacidade com a camada selecionada | Feito no painel · Falta atalho 0–9 | P1 | `SecaoAparencia.tsx` |
| Modo de mesclagem | Menu no título de Aparência/Camada | Feito (9 modos) | — | `SecaoAparencia.tsx` |
| Visibilidade no painel | Olho no título de Aparência | Feito (⇧⌘H também) | — | `SecaoAparencia.tsx` |
| Raio de canto | Campo com ícone; cantos independentes (4 campos) | Parcial — raio único; botão de cantos independentes aparece desativado ("em breve") | P1 (precisa de `radii` no schema + renderer) | `SecaoAparencia.tsx`, `lib/scene/schema.ts` |
| Suavização de cantos (squircle) | "Corner smoothing" 0–100% | Falta | P3 | — |
| Tipografia | Fonte, peso, tamanho, entrelinha, espaçamento, alinhamento H/V, decoração, caixa, estilos de texto | Feito (sem estilos de texto, sem auto largura/altura, sem truncar, sem listas) | P1 (redimensionamento auto do texto) | `SecoesTipo.tsx` |
| Preenchimento: lista com +/−, olho, % | Vários preenchimentos empilhados; olho oculta; % de opacidade do preenchimento | Parcial — 1 preenchimento por camada (cor + gradiente); olho = opacidade 0 ↔ anterior; "−" deixa transparente | P2 (lista de preenchimentos no schema) | `SecaoPreenchimento.tsx` |
| Ícone de estilos ao lado de Preenchimento | Abre estilos/variáveis de cor da biblioteca | Parcial — aba "Paleta" do seletor (paleta Mostra + cores da página) | P1 (estilos de cor do documento) | `SeletorCor.tsx` |
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
| Salvar como estilo | Criar estilo de cor a partir do seletor | Falta | P1 | — |

## 3. Seleção e camadas

| Recurso | Comportamento no Figma | Estado no Mostra | Prioridade | Arquivo |
|---|---|---|---|---|
| Clique, Shift+clique, laço | Seleção somada com ⇧; laço por área | Feito | — | `Canvas.tsx` |
| Selecionar tudo | ⌘A | Feito (ignora travadas/ocultas) | — | `EditorShell.tsx` |
| Seleção profunda | ⌘+clique seleciona camada dentro de grupo/frame; Enter / ⇧Enter descem/sobem na hierarquia | Falta (grupos são planos — `groupId`) | P1 | `Canvas.tsx` |
| Selecionar semelhantes | ⌥⌘A camadas iguais; Editar › Selecionar mesmo preenchimento/traço/fonte | Falta | P2 | — |
| Intervalo no painel de camadas | Shift+clique seleciona o intervalo | Parcial (Shift soma, não seleciona intervalo) | P2 | `PainelEsquerdo.tsx` |
| Renomear camada | Duplo clique no painel; ⌘R | Parcial — duplo clique e campo no cabeçalho do painel Design; sem ⌘R | P2 | `PainelEsquerdo.tsx`, `CabecalhoCamada.tsx` |
| Travar / ocultar | ⇧⌘L / ⇧⌘H | Parcial — ⌘L (Figma usa ⇧⌘L) e ⇧⌘H | P2 (alinhar atalho) | `EditorShell.tsx` |
| Ordem | `]` frente, `[` trás, ⌘] / ⌘[ um passo | Parcial — `]`/`[` e ⇧]/⇧[ para um passo (Figma usa ⌘) | P2 | `EditorShell.tsx` |
| Agrupar / frames | ⌘G, ⇧⌘G; ⌥⌘G cria frame | Parcial — agrupar/desagrupar planos; sem frames aninhados | P1 (frames para auto layout) | `useEditor.ts` |
| Máscara | ⌃⌘M usa a camada de baixo como máscara | Parcial — máscara de forma só em imagem | P3 | `SecoesTipo.tsx` |
| Operações booleanas | União, subtração, interseção, exclusão | Fora (camadas vetoriais vêm prontas como SVG) | P3 | — |

## 4. Ferramentas e canvas

| Recurso | Comportamento no Figma | Estado no Mostra | Prioridade | Arquivo |
|---|---|---|---|---|
| Ferramentas | V mover, K escala, F frame, R retângulo, O elipse, L linha, ⇧L seta, P caneta, T texto, H mão, C comentário | Parcial — V, T, R (forma), H (hotspot — no Figma H é a mão), espaço = mão, imagem pela barra | P1 (O/L e mão com H? decidir conflito com Hotspot) | `EditorShell.tsx` |
| Clique para digitar | T + clique cria caixa de texto com largura automática | Em andamento (outra frente) | P0 | `Canvas.tsx` |
| Redimensionar | ⇧ mantém proporção, ⌥ a partir do centro | Parcial — ⇧ proporção; sem ⌥ centro | P1 | `Canvas.tsx`, `lib/scene/transform.ts` |
| Rotacionar | Alça fora do canto; ⇧ passos de 15° | Feito (alça superior; ⇧ 15°) | — | `Canvas.tsx` |
| Mover com setas | 1 px; ⇧ 10 px (configurável) | Feito (sem configurar) | P3 | `EditorShell.tsx` |
| ⌥+arrastar duplica | Duplica enquanto arrasta | Falta (⌥ hoje desliga guias) | P1 | `Canvas.tsx` |
| Zoom | ⌘+roda / pinça, ⇧1 ajustar tudo, ⇧2 ajustar seleção, ⌘0 100% | Parcial — roda/pinça, ⇧1, ⌘0, +/−; sem ⇧2 | P2 | `Canvas.tsx` |
| Réguas e guias arrastáveis | ⇧R mostra réguas; arrastar cria guia | Parcial — flag `reguas` sem guias arrastáveis | P2 | `Canvas.tsx` |

## 5. Snapping e medidas

| Recurso | Comportamento no Figma | Estado no Mostra | Prioridade | Arquivo |
|---|---|---|---|---|
| Guias inteligentes | Bordas e centros de camadas vizinhas, distâncias iguais | Parcial — bordas/centros das camadas e da tela; espaçamento igual em andamento (outra frente) | P0 | `lib/editor/guias.ts` |
| Medir distâncias | Selecionar + segurar ⌥ e passar sobre outra camada mostra distâncias em vermelho | Falta | P0 | `Canvas.tsx` |
| Snap ao pixel | Snap to pixel grid (⇧⌘') | Parcial — posições inteiras ao arrastar; grade opcional | P2 | `Canvas.tsx` |
| Desligar snap temporariamente | Segurar ⌘ enquanto arrasta | Parcial — ⌥ desliga (diferente do Figma) | P1 (alinhar com ⌘) | `Canvas.tsx` |

## 6. Auto layout

| Recurso | Comportamento no Figma | Estado no Mostra | Prioridade | Arquivo |
|---|---|---|---|---|
| Ativar auto layout | ⇧A em frame ou camadas soltas (cria frame) | Em andamento (outra frente: `SecaoAutoLayout.tsx`) | P0 | `inspetor/SecaoAutoLayout.tsx` |
| Direção, gap, padding, alinhamento 3×3 | Horizontal/vertical/quebra; gap; padding por lado (⌘+clique abre os 4) | Em andamento | P0 | — |
| Hug / Fill / Fixed | Por eixo, em pais e filhos | Em andamento | P0 | — |
| Wrap, mín./máx., posição absoluta | Quebra com gap H/V; limites; filho ignorando o fluxo | Falta | P2 | — |

## 7. Componentes, estilos e variáveis

| Recurso | Comportamento no Figma | Estado no Mostra | Prioridade | Arquivo |
|---|---|---|---|---|
| Componentes e instâncias | ⌥⌘K cria componente; instâncias com overrides preservados | Falta (há "Blocos" prontos que inserem cópias) | P1 | `PainelEsquerdo.tsx` |
| Variantes e propriedades | Conjuntos de variantes; propriedades booleanas/texto/troca | Falta | P3 | — |
| Estilos de cor/texto/efeito | Estilos locais e de biblioteca aplicados pelo ícone de estilos | Parcial — tema do documento (paleta + fontes) e paleta Mostra no seletor; sem estilos nomeados | P1 | `lib/design-tokens.ts`, `SeletorCor.tsx` |
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
| Configurações de exportação | PNG/JPG/SVG/PDF; escala (2x, largura/altura fixas); sufixo; várias por camada | Parcial — seção "Exportar" recolhida com "+": copiar CSS, baixar SVG do vetor ou arquivo original | P1 (PNG/JPG da camada e da tela; PDF da apresentação) | `SecaoExportar.tsx` |
| Copiar como PNG / SVG | ⇧⌘C copia PNG; menu Copiar como SVG | Falta | P2 | `MenuContexto.tsx` |
| Copiar como CSS | Dev Mode / inspecionar mostra CSS | Feito ("Copiar CSS") | — | `SecaoExportar.tsx` |

## 10. Área de transferência

| Recurso | Comportamento no Figma | Estado no Mostra | Prioridade | Arquivo |
|---|---|---|---|---|
| Copiar/colar/recortar/duplicar | ⌘C ⌘V ⌘X ⌘D; colar mantém posição se houver espaço | Feito (desloca 24 px se sobrepuser) | — | `useEditor.ts`, `MenuContexto.tsx` |
| Colar sobre a seleção / substituir | ⇧⌘V cola por cima; ⇧⌘R substitui | Falta | P2 | — |
| Colar do Figma | Buffer próprio do Figma (não legível pelo navegador) | Parcial — SVG/PNG colados viram camadas; cópia nativa mostra aviso com o caminho "Copiar como SVG"; importação mais rica em andamento (outra frente) | P0 | `lib/importar/clipboard.ts` |
| Colar imagem/arquivo | Imagem vira preenchimento de retângulo | Feito (imagem, SVG, GLB, Lottie, links de embed) | — | `lib/editor/importar.ts` |

## 11. Atalhos — resumo do que falta

| Atalho Figma | Ação | Mostra hoje | Prioridade |
|---|---|---|---|
| ⌥A / ⌥D / ⌥H / ⌥W / ⌥S / ⌥V | Alinhar | — | P1 |
| ⇧H / ⇧V | Espelhar | só no painel | P1 |
| 0–9 | Opacidade 100%/10%…90% | — | P1 |
| ⇧A | Auto layout | em andamento | P0 |
| ⌥⌘K | Criar componente | — | P1 |
| ⌘R | Renomear | — | P2 |
| ⇧2 | Zoom na seleção | — | P2 |
| ⌘] / ⌘[ | Um passo à frente/atrás | ⇧] / ⇧[ | P2 |
| ⇧⌘L | Travar | ⌘L | P2 |
| I | Conta-gotas | só no seletor | P2 |
| ⌃⌥T | Tidy up | — | P2 |
| ⇧⌘C | Copiar como PNG | — | P2 |
| ⌃⇧? | Painel de atalhos | `?` | — |

---

## Notas de implementação (painel Design e seletor de cor)

- **Gestos com um único desfazer:** `ProvedorInspetor` (`inspetor/contexto.tsx`) guarda o documento no
  início de um arraste (rótulo de campo, área de cor, faixas, paradas, deslizantes) e registra uma única
  entrada no histórico ao soltar. Seções usam `useCamadas(editor).set/setFn`, que gravam sem histórico
  durante o gesto.
- **Seções plugáveis:** `AbaDesign.tsx` é só uma lista; cada `SecaoX({ editor, assets })` decide se aparece.
- **Matemática de cor pura** em `lib/editor/cor.ts` (testes em `cor.test.ts`).
- **Sem mudança de schema.** Itens que exigem schema estão marcados acima: cantos independentes, vários
  preenchimentos/sombras, gradiente angular/diamante, travar proporção persistente, posição do traço.
