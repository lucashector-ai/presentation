# ADR 0005 — Revisões, autosave e publicação

**Status:** aceito · **Data:** 2026-10-21

## Decisão
- **Rascunho** em `project_scenes`; **publicação** em `project_snapshots` (imutável por `(project_id, revision)`); `projects.published_revision` aponta para a revisão servida aos convidados. Rascunho nunca vaza (AC-11).
- **Concorrência otimista**: toda gravação envia `baseRevision`; `save_project_scenes` faz `SELECT … FOR UPDATE`, compara e incrementa em uma transação. Conflito → 409 com `currentRevision`; a UI mantém as mudanças locais e oferece *Recarregar* ou *Manter a minha*.
- **Autosave** (`lib/editor/useEditor.ts`): debounce de 800 ms, flush ao sair/`beforeunload`/`Ctrl+S`, estados `salvo | salvando | offline | falha | conflito`, retomada automática ao voltar a conexão.
- **Undo/redo** por comandos na sessão (até 100 passos); gestos contínuos (mover/redimensionar) viram uma entrada só. Recuperação persistente vem dos snapshots e do rascunho gravado, não do histórico.
- `schemaVersion` gravado em cenas e snapshots para migrações futuras do JSON.
