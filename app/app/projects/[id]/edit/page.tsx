import { EditorShell } from '@/components/editor/EditorShell'

export const metadata = { title: 'Editor' }

export default function Pagina({ params }: { params: { id: string } }) {
  return <EditorShell projetoId={params.id} />
}
