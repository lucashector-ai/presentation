# Animações do Mostra — catálogo e parâmetros

Implementação da referência de produto em `docs/animacoes-referencia.md`. O que o editor mostra é o que o
visualizador toca: o mesmo cálculo de estilo vale para o canvas (prévia), o Pré-visualizar, o `/apresentar` e o
link público.

## Onde mora cada coisa

| O quê | Arquivo |
| --- | --- |
| Tipos e campos salvos no documento | `lib/scene/schema.ts` (`AnimacaoSchema`, `LoopSchema`, `TransicaoSchema`, `EfeitosInterativosSchema`) |
| Família de keyframes, padrões e controles de cada tipo; variáveis CSS; intensidade | `lib/scene/parametros.ts` |
| Presets da galeria, nomes, velocidade, curvas, gatilhos, "Animar tela inteira", linha do tempo | `lib/scene/animacoes.ts` |
| Texto: ordem das partes, contador, curvas em JS, agrupamento de linhas | `lib/scene/texto-animado.ts` |
| Plano de animação da camada (keyframes, tempos, desfoque separado, soltar no fim) | `components/renderer/plano.ts` |
| Renderização (camada, texto dividido, contador, destaque, desenhar, prévia no editor) | `components/renderer/animacao.tsx`, `SceneRenderer.tsx` |
| Efeitos interativos: lógica pura (parallax, tilt, luz, profundidade automática) | `lib/scene/reativos.ts` |
| Efeitos interativos: invólucros da camada, ponteiro único, rolagem, voo do Explorar | `components/renderer/reativos.tsx` |
| Transições (empurrar, sentido, tela anterior por cima) e Story/Explorar | `components/viewer/Viewer.tsx`, `StoryView.tsx`, `ExplorarView.tsx` |
| Medição de fluidez | `e2e/desempenho.mjs` |
| Keyframes | `app/globals.css`, bloco "MOSTRA · ANIMAÇÕES DE CAMADA" |
| Painel | `components/editor/animacao/` (`AnimacaoTela`, `AnimacaoCamadas`, `Ajustes`, `Interativos`, `LinhaDoTempo`, `ui`) |

## Modelo de um efeito

Uma entrada/saída é `{ type, duration, delay, easing, bezier? }` mais ajustes opcionais. Ajuste ausente = o
visual padrão do preset, então documentos antigos tocam igual. O painel só grava o que mudou.

| Campo | Significado | Faixa |
| --- | --- | --- |
| `distance` | distância percorrida (px da cena; no texto, por parte) | 0–800 |
| `direction` | de onde vem (entrada) / para onde vai (saída); diagonais nos deslizes | `up`, `down`, `left`, `right`, `up-left`… |
| `scale` | escala inicial (entrada) ou final (saída) | 0–3 |
| `rotate` | giro inicial/final, em graus (no 3D, o ângulo) | −720–720 |
| `blur` | desfoque inicial/final, em px | 0–80 |
| `opacity` | opacidade inicial/final | 0–1 |
| `origin` | ponto fixo da escala/giro/íris (grade 3×3) | `center`, `top-left`… |
| `split`, `order`, `stagger` | texto: dividir por linha/palavra/letra, ordem (início, fim, centro, bordas, aleatória), intervalo entre partes em ms | — |
| `color`, `range` | destaque/sublinhado: cor do marcador e palavras marcadas | — |
| `trigger`, `after`, `on` | quando toca: ao entrar na tela, depois de outra camada, ao clicar, ao passar o mouse, acompanhando a rolagem (`scroll`) | — |
| `scrollRange` | `scroll`: trecho da passagem da camada pela janela em que a entrada acontece (0 = começa a aparecer, 100 = saiu) | `[0–100, 0–100]`, padrão `[0, 40]` |
| `repeat` | quantas vezes a entrada toca seguida (a sequência inteira, no texto dividido) | 1–20 |
| `progress`, `progressMax`, `progressColor`, `progressWidth` | contador: círculo em volta ou barra embaixo; valor que enche (padrão 100 com "%", senão o próprio número); cor; espessura | — |

Loops (`loopAnimation`) têm `type`, `duration`, `intensity` (0,25–3), `repeat` (ausente = sempre) e `until: 'offscreen'`
(repete até a camada sair da janela: no Story, ao rolar para longe; nos slides, até trocar de tela).

Transições de tela (`transition.type`): `none`, `fade`, `slide`, `scale`, `morph` e `push` (empurrar: a tela nova entra pela
lateral e empurra a anterior; voltando, o sentido inverte).

Efeitos interativos da camada (`interactiveEffects`, todos opcionais):

| Campo | Significado | Faixa |
| --- | --- | --- |
| `parallax.depth` | profundidade: + mais perto (anda mais, contra o mouse), − mais longe (anda menos, a favor) | −100–100 (Fraca 20 · Média 45 · Forte 80) |
| `parallax.axis` | eixos que seguem o mouse | `both`, `x`, `y` |
| `tilt.angle`, `scale`, `perspective`, `smooth` | inclinação máxima (°), quanto cresce com o mouse em cima, perspectiva (px), suavidade (0 cola no mouse, 1 bem macio) | 1–30° (4/8/14), 1–1,2, 300–4000, 0–1 |
| `spotlight.mode`, `size`, `intensity`, `color` | `light` (luz que segue o mouse) ou `dark` (lanterna: escurece em volta), raio em % do maior lado, força, cor | 5–150 %, 0–1 |

Movimentos (lib/scene/reativos.ts, `PARALLAX_PX`), com profundidade 100: mouse 40 px no canto; rolagem do Story ±80 px ao
longo da passagem pela janela; transição deslizar/empurrar 240 px a mais; voo do Explorar 280 px.

## Catálogo

- **Básicas:** Fade, Fade + movimento, Desfocar, Fade + desfoque, Escala, Expandir do centro.
- **Movimento:** Subir, Descer, Da esquerda, Da direita, Deslizar com rastro (desfoque de movimento), Girar,
  Rotação suave.
- **Revelar:** Cortina, Máscara (sobe de trás da própria borda), Íris, Desdobrar, Barra de progresso,
  Desenhar contorno (formas SVG; nas outras vira cortina).
- **3D:** Virar 3D, Dobrar 3D, Zoom profundo, Zoom out.
- **Ênfase (entrada):** Pop, Elástico, Quicar.
- **Texto:** Linha por linha (máscara), Palavras com desfoque, Letra por letra, Cascata elástica, Máquina de
  escrever (com cursor), Decodificar, Destaque (marca-texto), Sublinhado, Contador (mantém prefixo, sufixo,
  casas decimais e milhar: "38%", "R$ 2,4 mi", "1.250").
- **Loops:** Flutuar, Deriva, Pulsar, Brilho, Balançar, Tremer, Girar contínuo (repetir: Sempre, 1×, 2×, 3×, Até sair).
- **Interativos:** Parallax (profundidade), Tilt 3D, Luz, Lanterna — combináveis.
- **Contador:** com círculo ou barra de progresso que enche no mesmo tempo e curva do número.
- **Transições de tela:** Nenhuma, Fade, Deslizar, Zoom, Morph, Empurrar.
- **Saídas:** Fade, Dissolver, Desfocar, Encolher, Sumir encolhendo, Subir, Descer, Para a esquerda, Para a
  direita, Girar, Cortina, Máscara, Íris, Recolher, Virar 3D, Afastar.

## Painel (aba Animação)

1. **Galeria:** sugestões para a camada (texto → máscara/linhas/cascata; número → contador; imagem →
   cortina/zoom; linha → desenhar/expandir) e uma categoria por vez. Passar o mouse toca a prévia do cartão;
   clicar aplica e toca no canvas.
2. **Um clique:** Velocidade (rápida/normal/lenta), Quando, De onde vem, Distância (sutil 20 px · evidente
   80 px · dramático 200 px), Intensidade (fraca/média/forte, nos efeitos sem distância), Dividir por e Ordem
   (texto), cor e palavras do destaque.
3. **Ajustes finos** (recolhido): atraso, duração, curva (suave, rápida, equilibrada, elástica, quique suave,
   linear, personalizada com editor de curva) e deslizadores de distância, escala, giro, desfoque, opacidade,
   origem e intervalo entre partes; "ao rolar", onde começa e termina na passagem pela tela. "Padrão" volta aos
   valores do preset.
4. **Repetir** (1×, 2×, 3×, 5×) logo abaixo da Velocidade; **Quando → Acompanhando a rolagem** com Termina (Cedo, No
   meio, Tarde); no Contador, **Indicador** (Nenhum, Círculo, Barra), cor, "Cheio em" e espessura.
5. **Aba Interativo:** cartões Parallax, Tilt 3D, Luz e Lanterna (liga/desliga com um clique, combináveis; o cartão
   toca o efeito real com um ponteiro simulado ao passar o mouse). Para cada efeito ligado: Profundidade (mais
   perto/mais longe) e Intensidade (fraca/média/forte) e Ajustes finos (profundidade −100…100 e eixos; inclinação,
   quanto cresce, perspectiva e suavidade; tamanho e força da luz). Prévia: ponteiro simulado no canvas (2,4 s).

Sem seleção, a aba mostra a tela inteira: transição de entrada (com Empurrar), "Dar profundidade à tela" (parallax
automático: fundo longe, imagens no meio, títulos à frente; "Tirar a profundidade" desfaz), "Animar tela inteira" (estilos Suave,
Editorial, Dinâmico, Cinematográfico, Minimal; ordem de leitura: título → texto → imagens, cartões junto com o
seu texto) e a linha do tempo das camadas (arrastar move/estica; ↳ = em cadeia, ◎ = clique/hover).

## Regras de qualidade

- Durações padrão 400–1600 ms; deslizes de 20–48 px; entradas com ease-out (EXPO), saídas com ease-in,
  mola só em destaque.
- Recortes (cortina, máscara, íris) e o 3D terminam em 99,9% e soltam no último quadro: sombras não ficam
  cortadas e o texto não fica rasterizado.
- `prefers-reduced-motion`: toda entrada vira fade de 150 ms, saídas viram fade-out, sem loops nem texto
  dividido (o motor adapta e o CSS é a rede de segurança).
- Visualizador: as entradas esperam a tela de carregamento sumir; no Story cada seção anima quando aparece e
  toca a saída ao sair; no Explorar a tela que sai toca a saída antes do voo da câmera.
- Efeitos interativos e rolagem, por modo: **slides** — parallax segue o mouse e acompanha deslizar/empurrar; tilt e luz
  seguem o mouse. **Story** — parallax e entradas "ao rolar" acompanham a rolagem (CSS scroll-driven animations; sem
  suporte: parallax por um ouvinte de rolagem passivo com rAF e a entrada toca ao aparecer); tilt/luz no mouse.
  **Explorar** — parallax no mouse e no voo da câmera (as camadas da tela que chega entram deslocadas no sentido do
  voo); telas de contexto paradas. **Editor** — prévia com ponteiro simulado; transições e "ao rolar" tocam no tempo.
  Story e Explorar não usam transição de tela (empurrar vale para os slides e a prévia do editor).
- Movimento reduzido: sem parallax, tilt nem luz; "ao rolar" vira fade curto; empurrar vira fade; o contador mostra
  o valor final e o indicador já cheio. Toque (sem hover): sem tilt, luz nem parallax de mouse.

## Desempenho (60 fps)

Medição reproduzível: `E2E_BASE_URL=http://localhost:8800 node e2e/desempenho.mjs` (modo demo). Troca três
projetos de exemplo por apresentações carregadas de efeitos e mede, com e sem CPU throttling 4× (CDP), a duração
dos quadros (requestAnimationFrame), long tasks, layouts e recálculos de estilo de cada cenário (entradas, texto,
loops, saídas, morph, parallax, tilt, rolagem, Story, Explorar, galeria e prévia do editor); imprime a tabela (mediana
de 3 execuções) e falha se o p95 do quadro passar de 20 ms com 4× num cenário principal.

Cenários dos efeitos interativos: **parallax** (transição "empurrar" para uma tela com camadas em profundidades
diferentes, tilt, luz, lanterna e contador com círculo, e o mouse passeando por ela), **tilt** (o mouse passando pelos
três cartões com tilt + luz/lanterna) e **rolagem** (Story: vai e volta sobre cartões com entrada "ao rolar" e
parallax de rolagem).

Diagnóstico: `DESEMPENHO_CENARIOS=efeito-*` (um efeito de texto por tela), `DESEMPENHO_QUADROS=1` (quando caem os
quadros lentos), `DESEMPENHO_RASTRO=1` (animações fora da GPU, eventos por tipo e o que há dentro das tarefas longas),
`=2` (por keyframe; com `DESEMPENHO_AMOSTRA=1`, eventos de exemplo), `=3` (elementos por recálculo de estilo), `=4`
(o que é pintado), `=5` (o que a thread principal fez em cada quadro lento; `DESEMPENHO_TODOS=1` para todos os
eventos), `=6` (tempo ocupado de cada thread — inclusive o compositor (viz) e a rasterização — por quadro lento e em
média, quads e passes desenhados), `DESEMPENHO_PERFIL=1`, `DESEMPENHO_CAMADAS=1` (camadas compostas; com
`DESEMPENHO_CAMADAS_EM=ms`, no meio da animação), `DESEMPENHO_CSS` / `DESEMPENHO_JS` (CSS ou script injetados antes de
medir, para comparar hipóteses), `DESEMPENHO_CAPTURAS=pasta` (fotos em instantes fixos).

Regras que o renderizador segue (e o porquê):

- **Nada consulta o estilo por quadro.** `getAnimations()`, `playState` e `getComputedTiming()` forçam o recálculo
  de estilo. O tempo do contador, do decodificar e das partes do texto vem da liberação da tela (`quandoLiberar`:
  tela de carregamento, seção do Story fora da janela, câmera do Explorar — um MutationObserver na classe
  `.animacoes-em-espera`) e do relógio do quadro.
- **Partes do texto pela Web Animations API**, com keyframes resolvidos (`quadrosDasPartes`), e não por
  `animation-*` no estilo: animação CSS dispara `animationstart`/`animationend` por parte (o React trata cada um na
  raiz da página) e entra no recálculo das animações CSS a cada quadro. Máquina de escrever e decodificar nem
  animam: a letra só perde a espera (`data-espera`) no quadro em que começa; o cursor é uma animação só.
- **Só as partes em movimento são camadas.** Cada parte espera parada no 1º quadro por CSS (`[data-seg][data-espera]`
  + variáveis `--seg-de-*`, sem camada própria), ganha a animação pouco antes de começar (com `startTime` comum: o
  tempo é exato) e a perde logo depois de terminar (o último quadro é o estilo parado). Antes, todas as partes
  viravam camadas compostas desde o início — ~100 camadas recompostas e desenhadas a cada quadro.
- **Em lotes, numa grade comum** (`LOTE_MS` = 100 ms, a mesma para todos os textos da página): cada camada que nasce
  ou some obriga o navegador a refazer a composição da página inteira naquele quadro; parte a parte, com vários
  blocos de texto, isso acontecia em quase todo quadro.
- **No máximo 12 partes de um texto em movimento ao mesmo tempo** (`PARTES_SIMULTANEAS_MAX`, intervalo automático):
  acima disso o passo entre partes cresce e cada parte anda um pouco mais rápido; a duração total não muda.
- **Nada de opacidade animada num bloco com camadas dentro.** Opacidade num elemento com várias camadas compostas
  dentro obriga o compositor a desenhá-lo numa superfície própria (a área inteira duas vezes por quadro). Por isso:
  o contador anima o número sozinho (não o bloco com prefixo e sufixo); a transição de entrada preenche só para
  trás (`backwards`: com `both`, a tela inteira seguia como superfície depois do fim); no visualizador, fade,
  deslizar e zoom põem a **tela anterior por cima** sumindo (camada parada) e a nova só se move por baixo — a
  mesma mistura de cores; na prévia do editor, uma cortina da cor do canvas some por cima.
- **Tela que sai termina escondida** (`visibility: hidden` no último quadro) e fica parada (sem tocar as entradas
  de novo por baixo do fade).
- **Animação terminada sai do estilo.** A entrada da camada é solta no fim (o último quadro de toda entrada é o
  estilo parado — `components/renderer/plano.test.ts` garante).
- **Desfoque separado do movimento.** Filtro de desfoque nunca roda na GPU; o renderizador toca `anim-mov` +
  `anim-desfoque` (mesma duração, atraso e curva); nas partes, dois conjuntos de keyframes.
- **Leve por padrão no texto:** "Palavras com desfoque" usa o desfoque padrão até 12 palavras; letra por letra anima
  por palavra quando várias letras começariam no mesmo quadro, quando o texto passa de 150 letras ou quando cada
  letra teria desfoque em mais de 40 letras (`agruparLetras`). O texto animado é um limite de layout
  (`contain: size layout style` na caixa da camada): letras aparecendo, sorteio e contador não refazem o layout da
  tela. Decodificar: o caractere sorteado é um `<span>` com `contain: layout size`.
- **Re-render do visualizador não reconcilia a tela animando:** `SceneRenderer` é memorizado (tirar a tela que saiu
  do DOM, controles aparecendo/sumindo) e cada seção do Story também (a troca de fase de uma seção re-renderizava
  todas as telas no meio da rolagem).
- **Nada rodando escondido:** o pulso da tela de carregamento só enquanto carrega (escondida, a animação infinita
  rodava na thread principal a apresentação inteira); nos slides, a raiz não faz transição de cor (ela fica atrás
  das telas e repintava a área inteira a cada troca).
- **Efeitos interativos:** só transform/opacity em invólucros próprios; um ouvinte de mouse passivo e um
  requestAnimationFrame para todas as camadas, parando quando assenta; caixa da camada lida uma vez (ao entrar);
  parallax da rolagem por scroll-driven animation (fora da thread principal); transição e voo, uma animação de uma
  vez só.
- **Editor:** os painéis laterais são camadas próprias (`will-change`), as miniaturas fora da área visível não são
  pintadas (`content-visibility`), as sobreposições do canvas somem durante a prévia (marca na área do canvas, não
  no `<html>`: a troca recalcula só os filhos dela) e só o botão Prévia/Parar e o cursor da linha do tempo
  acompanham a prévia (o painel não re-renderiza no começo e no fim dela).
- **Editor, aba Animação:** o conteúdo da aba vem adiado (o clique pinta só o botão) e as miniaturas paradas da
  galeria são congeladas todas juntas no quadro seguinte (um `getAnimations()` por cartão forçava um recálculo de
  estilo cada). No canvas, cada camada é memorizada: arrastar uma camada não re-renderiza as outras.
- **Pré-carregamento:** 3D (model-viewer/three.js) e Lottie da próxima tela são baixados e avaliados com a página
  ociosa, não no meio da transição.
- Continuam fora da GPU por natureza (custo por quadro na thread principal): desfoque, recortes (cortina, máscara,
  íris), marca-texto/sublinhado, brilho em loop, morph (anima posição e tamanho), o número do contador e o anel de
  progresso (traço).
