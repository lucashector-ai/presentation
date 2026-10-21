import { AceitarConvite } from '@/components/app/AceitarConvite'

export const metadata = { title: 'Convite' }

/** /app/convite/:token — sem sessão, o Shell manda para o login e volta aqui depois. */
export default function Pagina({ params }: { params: { token: string } }) {
  return <AceitarConvite token={params.token} />
}
