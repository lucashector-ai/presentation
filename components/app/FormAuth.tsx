'use client'
import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { entrar } from '@/lib/sessao'
import { Botao, Campo, Entrada, Logo } from '@/components/ui'

export function FormAuth({ modo }: { modo: 'login' | 'signup' }) {
  const router = useRouter()
  const params = useSearchParams()
  const recuperar = params.get('recuperar') === '1'
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [nome, setNome] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [verificar, setVerificar] = useState(false)

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    setErro(null)
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return setErro('Informe um e-mail válido.')
    if (!recuperar && senha.length < 8) return setErro('A senha precisa ter pelo menos 8 caracteres.')
    setEnviando(true)
    await new Promise((r) => setTimeout(r, 400))
    if (recuperar) { setVerificar(true); setEnviando(false); return }
    if (modo === 'signup') { setVerificar(true); setEnviando(false); return }
    entrar(email)
    router.push('/app')
  }

  if (verificar) {
    return (
      <div className="text-center">
        <h1 className="text-xl font-semibold">Verifique seu e-mail</h1>
        <p className="mt-2 text-sm text-texto2">{recuperar ? 'Se existir uma conta para' : 'Enviamos um link de confirmação para'} <strong>{email}</strong>{recuperar ? ', enviamos um link para redefinir a senha.' : '.'}</p>
        <p className="mt-4 rounded-xl bg-superficie2 p-3 text-xs text-texto2">Modo demonstração: nenhum e-mail é enviado. Clique abaixo para continuar como se tivesse confirmado.</p>
        <Botao className="mt-4 w-full" onClick={() => { entrar(email); router.push('/app') }}>Continuar para o painel</Botao>
      </div>
    )
  }

  return (
    <form onSubmit={enviar} className="space-y-4" noValidate>
      <div className="mb-6"><Logo /></div>
      <h1 className="text-xl font-semibold">{recuperar ? 'Recuperar acesso' : modo === 'login' ? 'Entrar' : 'Criar conta'}</h1>
      {modo === 'signup' && !recuperar && <Campo rotulo="Nome"><Entrada autoComplete="name" value={nome} onChange={(e) => setNome(e.target.value)} /></Campo>}
      <Campo rotulo="E-mail"><Entrada type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></Campo>
      {!recuperar && <Campo rotulo="Senha" dica={modo === 'signup' ? 'Mínimo de 8 caracteres.' : undefined}><Entrada type="password" autoComplete={modo === 'login' ? 'current-password' : 'new-password'} value={senha} onChange={(e) => setSenha(e.target.value)} required /></Campo>}
      {erro && <p role="alert" className="text-sm text-perigo">{erro}</p>}
      <Botao type="submit" className="w-full" carregando={enviando}>{recuperar ? 'Enviar link' : modo === 'login' ? 'Entrar' : 'Criar conta'}</Botao>
      <div className="flex justify-between text-sm text-texto2">
        {modo === 'login' ? <Link href="/signup" className="hover:underline">Criar conta</Link> : <Link href="/login" className="hover:underline">Já tenho conta</Link>}
        {!recuperar && <Link href="/login?recuperar=1" className="hover:underline">Esqueci a senha</Link>}
      </div>
      <p className="pt-2 text-center text-xs text-texto2">Modo demonstração: qualquer e-mail e senha entram, com dados fictícios locais.</p>
    </form>
  )
}
