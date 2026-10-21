'use client'
import { useMemo, useState } from 'react'
import { Check, Copy, Link2, Lock, ShieldOff } from 'lucide-react'
import { criarLink, ErroDemo, listarLinks, obterProjeto, revogarLink } from '@/lib/demo/store'
import { useDemo } from '@/lib/demo/useDemo'
import { PLANOS } from '@/lib/planos'
import { estadoDoLink, senhaDeLinkValida, urlDoLink } from '@/lib/share/token'
import { Alternador, Botao, Campo, Entrada, ModalConfirmar, Selecao, Selo } from '@/components/ui'
import { useToast } from '@/components/ui/toast'

const BASE = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '')

export function Compartilhar({ projetoId }: { projetoId: string }) {
  const projeto = useDemo((e) => e.projetos.find((p) => p.id === projetoId))
  const links = useDemo(() => listarLinks(projetoId))
  const planoId = useDemo((e) => e.workspace.planoId)
  const [comSenha, setComSenha] = useState(false)
  const [senha, setSenha] = useState('')
  const [validade, setValidade] = useState<'0' | '7' | '30' | '90'>('0')
  const [criando, setCriando] = useState(false)
  const [novoToken, setNovoToken] = useState<string | null>(null)
  const [revogando, setRevogando] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)
  const { mostrar } = useToast()
  const podeSenha = PLANOS[planoId].capacidades.senhaNoLink
  const ativos = useMemo(() => links.filter((l) => estadoDoLink({ expiresAt: l.expiraEm, revokedAt: l.revogadoEm }) === 'ativo'), [links])

  if (!projeto) return null
  const publicado = projeto.revisaoPublicada != null
  const desatualizado = publicado && projeto.revisaoPublicada !== projeto.revisaoAtual

  const criar = async () => {
    if (comSenha && !senhaDeLinkValida(senha)) return mostrar('A senha precisa ter entre 4 e 64 caracteres.', 'erro')
    setCriando(true)
    try {
      const expiraEm = validade === '0' ? null : new Date(Date.now() + Number(validade) * 86400000).toISOString()
      const { token } = await criarLink(projetoId, { senha: comSenha ? senha : undefined, expiraEm })
      setNovoToken(token)
      setSenha('')
      mostrar('Link criado. Copie agora: por segurança ele não será exibido de novo.', 'sucesso')
    } catch (e) {
      mostrar(e instanceof ErroDemo ? e.message : 'Não foi possível criar o link.', 'erro')
    } finally {
      setCriando(false)
    }
  }

  const copiar = async (texto: string) => {
    try { await navigator.clipboard.writeText(texto); setCopiado(true); setTimeout(() => setCopiado(false), 1500) } catch { mostrar('Copie manualmente o endereço acima.', 'info') }
  }

  return (
    <div className="space-y-6">
      {!publicado && <p className="rounded-xl border border-dashed p-3 text-sm text-texto2">Publique o projeto no editor antes de criar links. Convidados sempre veem a última revisão publicada, nunca o rascunho.</p>}
      {desatualizado && <p className="rounded-xl bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">Há mudanças no rascunho que ainda não foram publicadas. Os links mostram a revisão {projeto.revisaoPublicada}.</p>}

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Novo link privado</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Validade">
            <Selecao value={validade} onChange={(e) => setValidade(e.target.value as typeof validade)}>
              <option value="0">Sem prazo</option><option value="7">7 dias</option><option value="30">30 dias</option><option value="90">90 dias</option>
            </Selecao>
          </Campo>
          <div>
            <div className="mb-1.5 flex items-center justify-between"><span className="text-[13px] font-medium">Proteger com senha</span><Alternador rotulo="Proteger com senha" ativo={comSenha} onChange={(v) => { if (!podeSenha) return mostrar('Links com senha estão disponíveis a partir do plano Creator.', 'info'); setComSenha(v) }} /></div>
            {comSenha ? <Entrada type="text" autoComplete="off" placeholder="Senha para o cliente (4 a 64 caracteres)" value={senha} onChange={(e) => setSenha(e.target.value)} /> : <p className="text-xs text-texto2">{podeSenha ? 'Quem abrir o link precisará digitar a senha.' : 'Disponível no plano Creator.'}</p>}
          </div>
        </div>
        <Botao onClick={criar} carregando={criando} disabled={!publicado} icone={<Link2 className="h-4 w-4" />}>Gerar link</Botao>
        {novoToken && (
          <div className="rounded-xl border bg-superficie2 p-3">
            <p className="mb-1 text-xs font-medium">Seu link (exibido uma única vez)</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded-lg bg-superficie px-2 py-1.5 text-xs">{urlDoLink(BASE, novoToken)}</code>
              <Botao tamanho="sm" variante="secundario" onClick={() => copiar(urlDoLink(BASE, novoToken))} icone={copiado ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}>{copiado ? 'Copiado' : 'Copiar'}</Botao>
            </div>
          </div>
        )}
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold">Links criados · {ativos.length} ativo(s)</h3>
        {links.length === 0 ? (
          <p className="text-sm text-texto2">Nenhum link ainda.</p>
        ) : (
          <ul className="divide-y rounded-xl border">
            {links.map((l) => {
              const estado = estadoDoLink({ expiresAt: l.expiraEm, revokedAt: l.revogadoEm })
              return (
                <li key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-sm">
                  <code className="text-xs text-texto2">…/p/{l.tokenPreview}••••</code>
                  <Selo tom={estado === 'ativo' ? 'sucesso' : estado === 'expirado' ? 'aviso' : 'neutro'}>{estado}</Selo>
                  {l.senhaHash && <span className="inline-flex items-center gap-1 text-xs text-texto2"><Lock className="h-3 w-3" /> senha</span>}
                  <span className="text-xs text-texto2">{l.visualizacoes} visualizações · criado em {new Date(l.criadoEm).toLocaleDateString('pt-BR')}{l.expiraEm ? ` · expira ${new Date(l.expiraEm).toLocaleDateString('pt-BR')}` : ''}</span>
                  <span className="ml-auto flex gap-1">
                    {estado === 'ativo' && l.tokenDemo && <Botao tamanho="sm" variante="fantasma" onClick={() => copiar(urlDoLink(BASE, l.tokenDemo))} icone={<Copy className="h-3.5 w-3.5" />}>Copiar</Botao>}
                    {estado === 'ativo' && <Botao tamanho="sm" variante="perigo" onClick={() => setRevogando(l.id)} icone={<ShieldOff className="h-3.5 w-3.5" />}>Revogar</Botao>}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
        <p className="mt-2 text-xs text-texto2">Limitação honesta: nenhuma solução web impede prints ou gravações de tela feitas por convidados autorizados.</p>
      </section>

      <ModalConfirmar aberto={!!revogando} aoFechar={() => setRevogando(null)} titulo="Revogar este link?" descricao="Quem tiver o link deixa de ver a apresentação imediatamente. Esta ação não pode ser desfeita." rotuloConfirmar="Revogar" perigoso
        aoConfirmar={() => { if (revogando) revogarLink(revogando); setRevogando(null); mostrar('Link revogado.') }} />
    </div>
  )
}

export function usarProjeto(id: string) {
  return obterProjeto(id)
}
