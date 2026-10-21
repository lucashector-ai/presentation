# ADR 0006 — Importação e área de transferência (Figma, Illustrator, navegador)

**Status:** aceito · **Data:** 2026-10-21

## Decisão
Colar (⌘V) e arrastar passam por um único interpretador, `lib/importar/clipboard.ts`, que lê o `DataTransfer` na ordem: camadas do próprio Mostra (marcador `MARCADOR_MOSTRA`) → SVG (texto ou `image/svg+xml`, inclusive dentro de HTML) → arquivos (imagem, vídeo, GLB/glTF, Lottie) → URL (vira embed se o host está na allowlist) → texto.

- **Illustrator** copia SVG como texto: vira camada `svg`. **Figma** copia um HTML proprietário (`(figmeta)`) que não é SVG; o usuário é orientado a usar *Copy as SVG*, que funciona como o Illustrator.
- **SVG é sempre sanitizado** com DOMPurify (perfil SVG, sem `script`, `foreignObject`, eventos, `href` externos) e renderizado como `<img src="data:image/svg+xml">`, que não executa scripts mesmo se algo escapar. No servidor, o `finalize` sanitiza de novo e regrava o arquivo (`isomorphic-dompurify`).
- Cores do SVG são extraídas (`coresDoSvg`) para recolorir pelo inspetor sem editar o arquivo.
- Formatos sem suporte nativo (`.ai`, `.fig`, `.psd`, `.blend`) recebem uma dica de como exportar (SVG/PNG/GLB) em vez de erro genérico.

## Consequências
Nenhum parser proprietário para manter; a fidelidade depende do export SVG da ferramenta de origem (fontes não embutidas viram a fonte padrão do navegador — o inspetor avisa).
