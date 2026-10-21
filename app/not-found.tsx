import Link from 'next/link'

export default function NaoEncontrado() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-xl font-semibold">Página não encontrada</h1>
      <Link href="/" className="text-sm underline">Voltar ao início</Link>
    </main>
  )
}
