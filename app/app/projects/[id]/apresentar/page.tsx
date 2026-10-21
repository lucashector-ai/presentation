import { Apresentar } from '@/components/app/Apresentar'

export const metadata = { title: 'Apresentar' }

export default function Pagina({ params }: { params: { id: string } }) {
  return <Apresentar id={params.id} />
}
