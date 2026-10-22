'use client'
/**
 * Equipe do espaço: quem participa, convidar (por e-mail ou link), mudar papel e remover. Usado nas
 * configurações e no botão "Convidar" do editor. Os limites (plano) e as permissões valem no servidor.
 */
import { useCallback, useEffect, useState } from 'react'
import { Check, Copy, Link2, Trash2, UserPlus } from 'lucide-react'
import { dados, mensagemDeErro, type Convite, type Equipe } from '@/lib/dados'
import { Botao, BotaoIcone, Campo, Entrada, Selecao, Selo, cx } from '@/components/ui'
import { useToast } from '@/components/ui/toast'

const PAPEL: Record<'owner' | 'editor' | 'viewer', string> = { owner: 'Dono', editor: 'Pode editar', viewer: 'Pode ver' }

export function PainelEquipe({ projetoId, aoSair }: { projetoId?: string; aoSair?: () => void }) {
  const { mostrar } = useToast()
  const [equipe, setEquipe] = useState<Equipe | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [papel, setPapel] = useState<'editor' | 'viewer'>('editor')
  const [enviando, setEnviando] = useState(false)
  const [gerado, setGerado] = useState<{ url: string; convite: Convite } | null>(null)
  const [copiado, setCopiado] = useState(false)

  const carregar = useCallback(() => {
    dados.equipe.obter().then((e) => { setEquipe(e); setErro(null) }, (e) => setErro(mensagemDeErro(e, 'Não foi possível carregar a equipe.')))
  }, [])
  useEffect(carregar, [carregar])

  const convidar = async (porEmail: boolean) => {
    setEnviando(true)
    try {
      const r = await dados.equipe.convidar({ ...(porEmail ? { email: email.trim() } : {}), papel, ...(projetoId ? { projetoId } : {}) })
      setGerado(r)
      setCopiado(false)
      setEmail('')
      carregar()
    } catch (e) {
      mostrar(mensagemDeErro(e, 'Não foi possível criar o convite.'), 'erro')
    } finally {
      setEnviando(false)
    }
  }
  const copiar = async (url: string) => {
    try { await navigator.clipboard.writeText(url); setCopiado(true) } catch { setCopiado(false) }
  }
  const acao = async (fn: () => Promise<void>, ok: string) => {
    try { await fn(); mostrar(ok, 'sucesso'); carregar() } catch (e) { mostrar(mensagemDeErro(e), 'erro') }
  }

  if (erro) return <p role="alert" className="text-[13px] text-perigo">{erro}</p>
  if (!equipe) return <p className="text-[13px] text-texto3">Carregando a equipe…</p>
  const dono = equipe.meuPapel === 'owner'
  const ocupadas = equipe.membros.length + equipe.convites.filter((c) => c.email).length
  const lotado = ocupadas >= equipe.limite

  return (
    <div className="space-y-6" data-testid="painel-equipe">
      {dono && (
        <div className="space-y-4">
          {/* campo, papel e botão com 40 px: com os rótulos iguais, items-end alinha rótulos e controles */}
          <form className="flex flex-col gap-2 sm:flex-row sm:items-end" onSubmit={(e) => { e.preventDefault(); if (email.trim()) void convidar(true) }}>
            <div className="min-w-0 flex-1"><Campo rotulo="E-mail de quem vai entrar"><Entrada type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nome@estudio.com" autoComplete="off" /></Campo></div>
            <div className="sm:w-36"><Campo rotulo="Papel">
              <Selecao aria-label="Papel do convite" value={papel} onChange={(e) => setPapel(e.target.value as 'editor' | 'viewer')}>
                <option value="editor">Pode editar</option>
                <option value="viewer">Pode ver</option>
              </Selecao>
            </Campo></div>
            <Botao type="submit" icone={<UserPlus className="h-4 w-4" />} carregando={enviando} disabled={!email.trim()}>Convidar</Botao>
          </form>
          <div className="flex flex-wrap items-center gap-2 text-[12px] text-texto2">
            <button type="button" className="inline-flex items-center gap-1 font-medium text-acento hover:underline disabled:opacity-50" disabled={enviando} onClick={() => void convidar(false)}><Link2 className="h-3.5 w-3.5" /> Criar link de convite</button>
            <span>· vale 7 dias para quem tiver o link · {ocupadas} de {equipe.limite} {equipe.limite === 1 ? 'vaga' : 'vagas'} do plano</span>
          </div>
          {lotado && <p className="text-[12px] text-[#7a5a12]">O plano deste espaço não tem vaga para mais pessoas. Convidar em equipe está disponível no plano Studio.</p>}
          {gerado && (
            <div className="rounded-controle border border-acento/40 bg-acento/5 p-4 text-[13px]" role="status">
              <div className="mb-2 font-medium">{gerado.convite.email ? `Convite para ${gerado.convite.email}` : 'Link de convite'} · {PAPEL[gerado.convite.papel]}</div>
              <div className="flex items-center gap-2">
                <code data-testid="link-convite" className="mono min-w-0 flex-1 truncate rounded bg-superficie px-2 py-1 text-[12px]">{gerado.url}</code>
                <Botao tamanho="sm" variante="secundario" icone={copiado ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} onClick={() => void copiar(gerado.url)}>{copiado ? 'Copiado' : 'Copiar'}</Botao>
              </div>
              <p className="mt-2 text-[12px] text-texto2">Envie este link {gerado.convite.email ? 'para a pessoa (só a conta com esse e-mail consegue aceitar)' : 'para quem você quer no espaço'}. Ele aparece só agora.</p>
            </div>
          )}
        </div>
      )}

      <div>
        <h3 className="mb-2 text-[12px] font-medium uppercase tracking-wide text-texto3">Pessoas em {equipe.workspace.nome}</h3>
        <ul className="divide-y divide-borda rounded-controle border border-borda" aria-label="Membros">
          {equipe.membros.map((m) => (
            <li key={m.userId} className="flex min-h-14 items-center gap-4 px-4 py-2 text-[13px]">
              <span className="min-w-0 flex-1"><span className="block truncate font-medium">{m.nome}{m.voce && <span className="font-normal text-texto3"> (você)</span>}</span><span className="block truncate text-[12px] text-texto2">{m.email}</span></span>
              {dono && m.papel !== 'owner' ? (
                <>
                  <div className="w-32 shrink-0">
                    <Selecao aria-label={`Papel de ${m.nome}`} value={m.papel} onChange={(e) => void acao(() => dados.equipe.alterarPapel(m.userId, e.target.value as 'editor' | 'viewer'), 'Papel atualizado.')} className="h-8 text-[12px]">
                      <option value="editor">Pode editar</option>
                      <option value="viewer">Pode ver</option>
                    </Selecao>
                  </div>
                  <BotaoIcone rotulo={`Remover ${m.nome}`} onClick={() => void acao(() => dados.equipe.remover(m.userId), `${m.nome} saiu do espaço.`)}><Trash2 className="h-4 w-4" /></BotaoIcone>
                </>
              ) : (
                <Selo tom={m.papel === 'owner' ? 'destaque' : 'neutro'}>{PAPEL[m.papel]}</Selo>
              )}
            </li>
          ))}
        </ul>
      </div>

      {dono && equipe.convites.length > 0 && (
        <div>
          <h3 className="mb-2 text-[12px] font-medium uppercase tracking-wide text-texto3">Convites pendentes</h3>
          <ul className="divide-y divide-borda rounded-controle border border-borda" aria-label="Convites pendentes">
            {equipe.convites.map((c) => (
              <li key={c.id} className="flex min-h-14 items-center gap-4 px-4 py-2 text-[13px]">
                <span className="min-w-0 flex-1 truncate">{c.email ?? 'Link de convite'} <span className="text-texto3">· {PAPEL[c.papel]} · até {new Date(c.expiraEm).toLocaleDateString('pt-BR')}</span></span>
                <Botao tamanho="sm" variante="fantasma" onClick={() => void acao(() => dados.equipe.revogarConvite(c.id), 'Convite revogado.')}>Revogar</Botao>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!dono && (
        <div className={cx('flex flex-wrap items-center justify-between gap-2 rounded-controle bg-superficie2 px-4 py-2 text-[13px] text-texto2')}>
          <span>Você {equipe.meuPapel === 'viewer' ? 'pode ver' : 'pode editar'} os projetos deste espaço. Quem administra é {equipe.membros.find((m) => m.papel === 'owner')?.nome ?? 'o dono'}.</span>
          <Botao tamanho="sm" variante="secundario" onClick={() => void acao(async () => { const eu = equipe.membros.find((m) => m.voce); if (eu) await dados.equipe.remover(eu.userId); aoSair?.(); window.location.assign('/app') }, 'Você saiu do espaço.')}>Sair do espaço</Botao>
        </div>
      )}
    </div>
  )
}
