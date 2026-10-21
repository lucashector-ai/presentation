import { DetalheProjeto } from '@/components/app/DetalheProjeto'

export const metadata = { title: 'Projeto' }

export default function Pagina({ params }: { params: { id: string } }) {
  return <DetalheProjeto id={params.id} />
}
