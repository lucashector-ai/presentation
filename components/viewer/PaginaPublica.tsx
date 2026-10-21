'use client'
import { useEffect, useState, type FormEvent } from 'react'
import { Lock } from 'lucide-react'
import { desbloquear, ErroDemo, resolverToken, type ResolucaoLink } from '@/lib/demo/store'
import { tokenValido } from '@/lib/share/token'
import { Botao, Entrada, Logo } from '@/components/ui'
import { Viewer } from './Viewer'

/** /p/:token — visualizador público não listado (Fluxo C). Nunca revela se o link existe, expirou ou foi revogado. */
export function PaginaPublica({ token }: { token: string }) {
  const [res, setRes] = useState<ResolucaoLink | null>(null)
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [liberados, setLiberados] = useState<Set<string>>(new Set())

  useEffect(() => {
    let ativo = true
    if (!tokenValido(token) && !token.startsWith('demo_')) { setRes({ state: 'unavailable' }); return }
    resolverToken(token, liberados).then((r) => ativo && setRes(r)).catch(() => ativo && setRes({ state: 'unavailable' }))
    return () => { ativo = false }
  }, [token, liberados])

  if (!res) return <div className="flex h-dvh items-center justify-center bg-[#0F1620] text-sm text-white/70" role="status">Carregando…</div>

  if (res.state === 'unavailable') {
    return (
      <main className="flex h-dvh flex-col items-center justify-center gap-3 bg-fundo p-6 text-center">
        <Logo />
        <h1 className="text-xl font-semibold">Este link não está mais disponível.</h1>
        <p className="max-w-sm text-sm text-texto2">Peça um novo link a quem compartilhou a apresentação com você.</p>
      </main>
    )
  }

  if (res.state === 'locked') {
    const enviar = async (e: FormEvent) => {
      e.preventDefault()
      setEnviando(true)
      setErro(null)
      try {
        const r = await desbloquear(token, senha)
        if (r.ok) setLiberados(new Set([...liberados, r.linkId]))
        else setErro(r.bloqueado ? 'Muitas tentativas. Aguarde alguns minutos.' : `Senha incorreta. Tente novamente.${r.restantes <= 2 ? ` (${r.restantes} tentativa(s) restante(s))` : ''}`)
      } catch (err) {
        setErro(err instanceof ErroDemo ? err.message : 'Não foi possível verificar.')
      } finally {
        setEnviando(false)
      }
    }
    return (
      <main className="flex h-dvh items-center justify-center bg-fundo p-5">
        <form onSubmit={enviar} className="w-full max-w-sm rounded-2xl border bg-superficie p-6 sm:p-8">
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-superficie2"><Lock className="h-5 w-5" /></div>
          <h1 className="text-lg font-semibold">{res.projectName}</h1>
          <p className="mb-4 text-sm text-texto2">Esta apresentação é protegida. Digite a senha que você recebeu.</p>
          <Entrada type="password" autoFocus autoComplete="off" aria-label="Senha" value={senha} onChange={(e) => setSenha(e.target.value)} className="h-12 text-base" />
          {erro && <p role="alert" className="mt-2 text-sm text-perigo">{erro}</p>}
          <Botao type="submit" tamanho="lg" className="mt-4 w-full" carregando={enviando} disabled={!senha}>Abrir apresentação</Botao>
        </form>
      </main>
    )
  }

  return (
    <div className="h-dvh w-full bg-black">
      <Viewer documento={res.documento} assets={res.assets} nome={res.projectName} marca />
    </div>
  )
}
