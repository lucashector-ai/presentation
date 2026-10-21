# Animações do Mostra — catálogo e parâmetros

Implementação da referência de produto em `docs/animacoes-referencia.md`. O que o editor mostra é o que o
visualizador toca: o mesmo cálculo de estilo vale para o canvas (prévia), o Pré-visualizar, o `/apresentar` e o
link público.

## Onde mora cada coisa

| O quê | Arquivo |
| --- | --- |
| Tipos e campos salvos no documento | `lib/scene/schema.ts` (`AnimacaoSchema`, `LoopSchema`) |
| Família de keyframes, padrões e controles de cada tipo; variáveis CSS; intensidade | `lib/scene/parametros.ts` |
| Presets da galeria, nomes, velocidade, curvas, gatilhos, "Animar tela inteira", linha do tempo | `lib/scene/animacoes.ts` |
| Texto: ordem das partes, contador, curvas em JS, agrupamento de linhas | `lib/scene/texto-animado.ts` |
| Renderização (camada, texto dividido, contador, destaque, desenhar, prévia no editor) | `components/renderer/animacao.tsx`, `SceneRenderer.tsx` |
| Keyframes | `app/globals.css`, bloco "MOSTRA · ANIMAÇÕES DE CAMADA" |
| Painel | `components/editor/animacao/` (`AnimacaoTela`, `AnimacaoCamadas`, `Ajustes`, `LinhaDoTempo`, `ui`) |

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
| `trigger`, `after`, `on` | quando toca: ao entrar na tela, depois de outra camada, ao clicar, ao passar o mouse | — |

Loops (`loopAnimation`) têm `type`, `duration`, `intensity` (0,25–3) e `repeat` (ausente = sempre).

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
- **Loops:** Flutuar, Deriva, Pulsar, Brilho, Balançar, Tremer, Girar contínuo.
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
   origem e intervalo entre partes. "Padrão" volta aos valores do preset.

Sem seleção, a aba mostra a tela inteira: transição de entrada, "Animar tela inteira" (estilos Suave,
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
