# ADR 0007 — 3D, Lottie e embeds

**Status:** aceito · **Data:** 2026-10-21

## Decisão
- **3D**: camada `model3d` com `<model-viewer>` (Google), carregado sob demanda (import dinâmico). Formato de entrada: **GLB** (detectado pelos bytes `glTF`) ou glTF **autocontido** (texturas em data URI). É o export padrão do Blender (*File → Export → glTF 2.0 → .glb*). Opções: rotação automática, controle de câmera, ângulo inicial, exposição, sombra, fundo. O pôster (imagem) é exigido para publicação (`modelo_sem_poster`) e usado nas miniaturas e em `prefers-reduced-motion`.
- **Lottie**: camada `lottie` com `lottie_light` (sem `eval` de expressões, compatível com CSP), JSON validado por `ehLottie`.
- **Embeds**: `iframe` com `sandbox` e allowlist de hosts (`HOSTS_EMBED`: YouTube, Vimeo, Figma, Spline, Loom…). Qualquer outro host é recusado na validação.

## Por que não three.js direto
`<model-viewer>` entrega iluminação PBR, AR, carregamento progressivo e acessibilidade prontos, com uma fração do código. Cenas 3D compostas (vários objetos animados) ficam para a Fase 2.
