/** Escreve app/cursores.css a partir de lib/editor/cursores.ts (npm run cursores). */
import { writeFileSync } from 'node:fs'
// @ts-ignore -- o Node roda TypeScript direto e precisa da extensão .ts no caminho
import { cssCursores } from '../lib/editor/cursores.ts'

writeFileSync(new URL('../app/cursores.css', import.meta.url), cssCursores())
