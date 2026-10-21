'use client'
import { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Plus, Upload, X } from 'lucide-react'
import { dados, ehErroDados, mensagemDeErro, useDados, type AssetDemo } from '@/lib/dados'
import { TEMPLATES, montarDocumento } from '@/lib/ia/roteiro'
import { EXTENSOES_ACEITAS } from '@/lib/importar/arquivos'
import { sanitizarSvgNavegador } from '@/lib/editor/importar'
import { documentoDePaginas } from '@/lib/pdf/paginas'
import { PLANOS } from '@/lib/planos'
import { FORMATOS, novaCena, parseCamada, SCHEMA_VERSION, type Cena, type ModoProjeto } from '@/lib/scene/schema'
import { importarPaginasPdf } from './importarPdf'
import { enquadrarNaCena } from '@/lib/scene/transform'
import { CapaProjeto } from './CapaProjeto'
import { cx } from '@/components/ui'
import { useToast } from '@/components/ui/toast'

const FORMATOS_UI: { id: ModoProjeto; nome: string; descricao: string }[] = [
  { id: 'slides', nome: 'Slides', descricao: 'Telas em sequência, com transições entre elas.' },
  { id: 'story', nome: 'Story', descricao: 'Narrativa vertical contínua, guiada pelo scroll.' },
  { id: 'explorar', nome: 'Explorar', descricao: 'Espaço interativo com navegação livre e hotspots.' },
]

const ehPdf = (f: File) => /\.pdf$/i.test(f.name) || f.type === 'application/pdf'

function Ilustracao({ modo }: { modo: ModoProjeto }) {
  if (modo === 'slides') return (
    <div className="relative h-full w-full">
      <div className="absolute left-[48%] top-[34%] h-[36%] w-[28%] rounded-[3px] bg-[#E2E1DE]" />
      <div className="absolute left-[12%] top-[28%] h-[42%] w-[50%] rounded-[3px] bg-white shadow-[0_6px_16px_-8px_rgba(0,0,0,.2)]"><div className="ml-[12%] mt-[12%] h-[8%] w-[40%] bg-grafite" /><div className="ml-[12%] mt-[6%] h-[4%] w-[28%] bg-[#E2E1DE]" /></div>
      <div className="absolute bottom-[14%] left-[12%] flex gap-1"><span className="h-[2px] w-4 bg-acento" /><span className="h-[2px] w-2 bg-[#D4D4D4]" /><span className="h-[2px] w-2 bg-[#D4D4D4]" /></div>
    </div>
  )
  if (modo === 'story') return (
    <div className="relative mx-auto h-full w-[36%] bg-white">
      <div className="mx-[8%] mt-[8%] h-[30%] bg-[#E2E1DE]" /><div className="mx-[8%] mt-[4%] h-[3%] w-[60%] bg-grafite" /><div className="mx-[8%] mt-[3%] h-[2%] w-[40%] bg-[#E2E1DE]" /><div className="mx-[8%] mt-[4%] h-[30%] bg-[#E2E1DE]" />
      <span className="absolute -right-[18%] top-[14%] h-[30%] w-[2px] bg-acento" /><span className="absolute -right-[18%] top-[44%] h-[22%] w-[2px] bg-[#D4D4D4]" />
    </div>
  )
  return (
    <div className="relative h-full w-full">
      <div className="absolute left-[14%] top-[18%] h-[30%] w-[30%] rounded-[3px] bg-white shadow-sm" /><div className="absolute right-[12%] top-[12%] h-[34%] w-[26%] rounded-[3px] bg-[#E2E1DE]" /><div className="absolute bottom-[14%] left-[40%] h-[30%] w-[34%] rounded-[3px] bg-white shadow-sm" />
      <span className="absolute left-[38%] top-[44%] h-2.5 w-2.5 rounded-full border-[1.5px] border-acento bg-acentoSuave" /><span className="absolute right-[32%] top-[52%] h-2.5 w-2.5 rounded-full border-[1.5px] border-acento bg-acentoSuave" />
    </div>
  )
}

export function NovoProjeto() {
  const router = useRouter()
  const { mostrar } = useToast()
  const params = useSearchParams()
  // atalhos do painel: /app/novo?comeco=template e /app/novo?passo=arquivos
  const [passo, setPasso] = useState<1 | 2>(() => (params.get('passo') === 'arquivos' ? 2 : 1))
  const [nome, setNome] = useState('')
  const [cliente, setCliente] = useState('')
  const [descricao, setDescricao] = useState('')
  const [modo, setModo] = useState<ModoProjeto>('slides')
  const [comeco, setComeco] = useState<'branco' | 'template'>(() => (params.get('comeco') === 'template' ? 'template' : 'branco'))
  const [template, setTemplate] = useState(TEMPLATES[0]!.id)
  const [arquivos, setArquivos] = useState<File[]>([])
  const [criando, setCriando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [textoSelecionavel, setTextoSelecionavel] = useState(true)
  const [progresso, setProgresso] = useState<string | null>(null)
  const planoId = useDados((e) => e.workspace.planoId)
  const entrada = useRef<HTMLInputElement>(null)
  const temPdf = arquivos.some(ehPdf)
  const templatesDoModo = TEMPLATES.filter((t) => t.modo === modo || modo === 'slides')
  const tpl = TEMPLATES.find((t) => t.id === template)
  const previas = useMemo(() => Object.fromEntries(TEMPLATES.map((t) => [t.id, montarDocumento(t.roteiro, { modo: t.modo, tema: t.tema, estilo: t.estilo })])), [])

  const resumo = `${nome.trim() || 'Sem título'} · ${FORMATOS_UI.find((f) => f.id === modo)!.nome} · ${comeco === 'branco' ? 'Em branco' : tpl?.nome}`

  const criar = async () => {
    setCriando(true)
    setErro(null)
    try {
      let documento = comeco === 'template' && tpl ? montarDocumento(tpl.roteiro, { modo, tema: tpl.tema, estilo: tpl.estilo }) : undefined
      // PDFs: cada página vira uma tela (imagem em alta resolução + texto selecionável opcional)
      const paginasPdf: Cena[] = []
      for (const f of arquivos.filter(ehPdf)) {
        try {
          const r = await importarPaginasPdf(f, { planoId, textoSelecionavel, aoProgredir: ({ pagina, total }) => setProgresso(`${f.name}: página ${pagina} de ${total}`) })
          paginasPdf.push(...documentoDePaginas(r.paginas, modo, { textoSelecionavel }).scenes.map((c) => ({ ...c, id: `pdf${paginasPdf.length}-${c.id}`.slice(0, 64) })))
          if (r.deFora > 0) mostrar(`${f.name}: o plano ${PLANOS[planoId].nome} importa até ${PLANOS[planoId].limites.paginasPdfImportar} páginas; ${r.deFora} ficaram de fora.`, 'erro', { rotulo: 'Ver planos', aoClicar: () => router.push('/app/settings#plano') })
        } catch (e) {
          mostrar(e instanceof Error && e.name === 'ErroLeitura' ? `${f.name}: ${e.message}` : mensagemDeErro(e, `Não foi possível importar ${f.name}`), 'erro')
        }
      }
      setProgresso(null)
      // só PDFs e nenhum deu certo: não cria um projeto vazio no lugar do que a pessoa pediu
      if (arquivos.length && arquivos.every(ehPdf) && !paginasPdf.length) {
        setErro('Não foi possível importar o PDF. Tente outro arquivo.')
        setCriando(false)
        return
      }
      if (paginasPdf.length) documento = { schemaVersion: SCHEMA_VERSION, mode: modo, scenes: [...(documento?.scenes ?? []), ...paginasPdf] }
      const midias = arquivos.filter((f) => !ehPdf(f))
      if (midias.length) {
        const prontos: AssetDemo[] = []
        for (const f of midias) {
          try { prontos.push(await dados.enviarArquivo(f, () => undefined, { sanitizarSvg: sanitizarSvgNavegador })) } catch (e) { mostrar(mensagemDeErro(e, `Não foi possível importar ${f.name}`), 'erro') }
        }
        const size = modo === 'story' ? FORMATOS.story : FORMATOS.slides169
        const telas = prontos.map((a, i) => {
          const tipo = a.tipo === 'video' ? 'video' : a.tipo === 'model3d' ? 'model3d' : a.tipo === 'lottie' ? 'lottie' : a.tipo === 'svg' ? 'svg' : 'image'
          const r = tipo === 'image' ? { x: 0, y: 0, width: size.width, height: size.height } : enquadrarNaCena({ width: a.width ?? size.width * 0.6, height: a.height ?? size.height * 0.6 }, size, size.height * 0.1)
          return novaCena({ id: `tela-${String(i + 1).padStart(2, '0')}`, title: a.nome.replace(/\.[^.]+$/, ''), size, background: '#FAFAF9', layers: [parseCamada({ id: 'midia', type: tipo, assetId: a.id, ...r, ...(tipo === 'image' ? { fit: 'cover' } : {}) })], ...(modo === 'explorar' ? { map: { x: (i % 3) * (size.width + 360), y: Math.floor(i / 3) * (size.height + 360) } } : {}) })
        })
        if (telas.length) documento = { schemaVersion: SCHEMA_VERSION, mode: modo, scenes: documento ? [...documento.scenes, ...telas] : telas }
      }
      const nomePdf = !nome.trim() && arquivos.length === 1 && ehPdf(arquivos[0]!) ? arquivos[0]!.name.replace(/\.pdf$/i, '').slice(0, 80) : ''
      const p = await dados.criarProjeto({ nome: nomePdf || nome, modo, cliente, descricao, documento })
      router.push(`/app/projects/${p.id}/edit`)
    } catch (e) {
      setProgresso(null)
      setErro(mensagemDeErro(e, 'Não foi possível criar o projeto.'))
      if (ehErroDados(e, 'limite_do_plano')) mostrar(e.message, 'erro', { rotulo: 'Ver planos', aoClicar: () => router.push('/app/settings#plano') })
      setCriando(false)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-fundo">
      <header className="flex h-[60px] items-center justify-between border-b border-borda px-6">
        <nav aria-label="Trilha" className="flex items-center gap-3 text-[14px]"><Link href="/app" className="text-texto2 hover:text-texto">Início</Link><span className="text-[#D4D4D4]">/</span><span className="font-medium">Novo projeto</span></nav>
        <Link href="/app" aria-label="Fechar" className="rounded-md p-1.5 text-texto2 hover:bg-hover"><X className="h-4 w-4" /></Link>
      </header>

      <main className="mx-auto grid w-full max-w-[1136px] flex-1 gap-12 px-6 py-14 lg:grid-cols-[400px_minmax(0,1fr)] lg:gap-[200px]">
        {passo === 1 ? (
          <>
            <section>
              <div className="rotulo-mono">Passo 1 de 2</div>
              <h1 className="titulo-display mt-2 text-[40px]">Novo projeto.</h1>
              <div className="mt-6 space-y-5">
                <label className="block"><span className="mb-2 block text-[13px] font-medium">Nome do projeto</span><input autoFocus value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Atlas Cerâmica — Identidade" className="h-11 w-full rounded-lg border border-[#E7E5E4] bg-superficie px-3.5 text-[14px] outline-none placeholder:text-texto3 focus:border-acento" /></label>
                <label className="block"><span className="mb-2 block text-[13px] font-medium">Cliente <span className="font-normal text-texto3">· opcional</span></span><input value={cliente} onChange={(e) => setCliente(e.target.value)} placeholder="Nome do cliente" className="h-11 w-full rounded-lg border border-[#E7E5E4] bg-superficie px-3.5 text-[14px] outline-none placeholder:text-texto3 focus:border-acento" /></label>
                <label className="block"><span className="mb-2 block text-[13px] font-medium">Descrição</span><textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={4} placeholder="Contexto, objetivo e para quem será apresentado." className="w-full resize-y rounded-lg border border-[#E7E5E4] bg-superficie px-3.5 py-3 text-[14px] outline-none placeholder:text-texto3 focus:border-acento" /></label>
              </div>
            </section>
            <section>
              <div className="mb-3 text-[13px] font-medium">Formato</div>
              <div role="radiogroup" aria-label="Formato" className="grid gap-4 sm:grid-cols-2">
                {FORMATOS_UI.map((f) => (
                  <button key={f.id} type="button" role="radio" aria-checked={modo === f.id} onClick={() => setModo(f.id)} className={cx('rounded-xl border-[1.5px] bg-superficie p-2.5 text-left transition-colors', modo === f.id ? 'border-acento' : 'border-borda hover:border-[#D4D4D4]')}>
                    <div className="aspect-[4/3] overflow-hidden rounded-lg bg-[#F2F1EF] py-[6%]"><Ilustracao modo={f.id} /></div>
                    <div className="flex items-start justify-between px-1.5 pb-1.5 pt-3">
                      <div><div className="text-[15px] font-medium">{f.nome}</div><div className="mt-1 text-[13px] leading-snug text-texto2">{f.descricao}</div></div>
                      <span className={cx('mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-[1.5px]', modo === f.id ? 'border-acento' : 'border-[#D4D4D4]')}>{modo === f.id && <span className="h-2 w-2 rounded-full bg-acento" />}</span>
                    </div>
                  </button>
                ))}
              </div>
              <div className="mt-8 flex items-center justify-between">
                <span className="text-[13px] font-medium">Começar</span>
                <div className="inline-flex rounded-lg bg-[#EFEEEC] p-[3px] text-[13px]" role="radiogroup" aria-label="Começar">
                  {(['branco', 'template'] as const).map((c) => <button key={c} type="button" role="radio" aria-checked={comeco === c} onClick={() => setComeco(c)} className={cx('rounded-md px-3 py-1.5', comeco === c ? 'bg-superficie shadow-sm' : 'text-texto2')}>{c === 'branco' ? 'Em branco' : 'Usar template'}</button>)}
                </div>
              </div>
              {comeco === 'branco' ? (
                <div className="mt-3 flex items-center gap-3 rounded-xl border border-dashed border-[#D4D4D4] p-4 text-[13px] text-texto2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-md border border-borda bg-superficie text-texto"><Plus className="h-3.5 w-3.5" /></span>
                  Uma tela em branco no formato escolhido. Você pode importar imagens, SVG e modelos 3D em seguida.
                </div>
              ) : (
                <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                  {templatesDoModo.map((t) => (
                    <li key={t.id}>
                      <button type="button" aria-pressed={template === t.id} onClick={() => setTemplate(t.id)} className={cx('w-full rounded-xl border-[1.5px] bg-superficie p-2 text-left', template === t.id ? 'border-acento' : 'border-borda hover:border-[#D4D4D4]')}>
                        <div className="overflow-hidden rounded-md">{previas[t.id]?.scenes[0] && <CapaProjeto cena={previas[t.id]!.scenes[0]!} assets={{}} proporcao={16 / 9} />}</div>
                        <div className="px-1 pb-1 pt-2"><div className="text-[13px] font-medium">{t.nome}</div><div className="text-[12px] text-texto2">{t.descricao} · {previas[t.id]?.scenes.length} telas</div></div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        ) : (
          <>
            <section>
              <div className="rotulo-mono">Passo 2 de 2</div>
              <h1 className="titulo-display mt-2 text-[40px]">Traga seu material.</h1>
              <p className="mt-4 text-[14px] leading-relaxed text-texto2">Cada imagem vira uma tela, e cada página de um PDF também: apresente um PDF pronto com as transições e animações do Mostra. SVGs do Figma e do Illustrator viram vetores editáveis, GLB do Blender vira 3D, JSON do After Effects vira Lottie. Você também pode pular e colar tudo depois, direto no editor.</p>
            </section>
            <section>
              <input ref={entrada} type="file" multiple accept={`${EXTENSOES_ACEITAS},.pdf,application/pdf`} aria-label="Arquivos do projeto" className="hidden" onChange={(e) => { const novos = Array.from(e.target.files ?? []); setArquivos((a) => [...a, ...novos]); e.target.value = '' }} />
              <button type="button" onClick={() => entrada.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const soltos = Array.from(e.dataTransfer.files); setArquivos((a) => [...a, ...soltos]) }} className="flex w-full flex-col items-center gap-2 rounded-xl border-[1.5px] border-dashed border-[#D4D4D4] bg-superficie px-6 py-14 text-center hover:border-acento">
                <Upload className="h-5 w-5 text-texto2" />
                <span className="text-[15px] font-medium">Arraste arquivos aqui ou clique para escolher</span>
                <span className="text-[13px] text-texto3">PDF, PNG, JPG, WebP, GIF, SVG, MP4, WebM, GLB/GLTF, Lottie (JSON)</span>
              </button>
              {temPdf && (
                <label className="mt-4 flex items-start gap-3 rounded-xl border border-borda bg-superficie px-4 py-3 text-[13px]">
                  <input type="checkbox" checked={textoSelecionavel} onChange={(e) => setTextoSelecionavel(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#5965F2]" />
                  <span>
                    <span className="block font-medium">Texto selecionável nas páginas do PDF</span>
                    <span className="mt-0.5 block text-texto3">O texto de cada página fica por cima da imagem, invisível: dá para selecionar, copiar e buscar ao apresentar, e editar no editor. Cada página vira uma tela em alta resolução; até {PLANOS[planoId].limites.paginasPdfImportar} páginas no plano {PLANOS[planoId].nome}.</span>
                  </span>
                </label>
              )}
              {arquivos.length > 0 && (
                <ul className="mt-4 divide-y divide-borda rounded-xl border border-borda bg-superficie">
                  {arquivos.map((f, i) => (
                    <li key={`${f.name}-${i}`} className="flex items-center justify-between px-4 py-2.5 text-[13px]">
                      <span className="truncate">{f.name}</span>
                      <button type="button" aria-label={`Remover ${f.name}`} onClick={() => setArquivos((a) => a.filter((_, j) => j !== i))} className="rounded p-1 text-texto3 hover:text-perigo"><X className="h-3.5 w-3.5" /></button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </main>

      <footer className="sticky bottom-0 border-t border-borda bg-fundo/95 backdrop-blur">
        <div className="mx-auto flex h-[76px] max-w-[1136px] items-center justify-between gap-4 px-4 sm:px-6">
          <span className={cx('min-w-0 truncate text-[13px] text-texto2', !erro && !progresso && 'hidden sm:block')} aria-live="polite">{erro ? <span className="text-perigo" role="alert">{erro}</span> : progresso ? `Importando ${progresso}…` : resumo}{arquivos.length && !progresso ? ` · ${arquivos.length} arquivo(s)` : ''}</span>
          <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
            {passo === 1 ? <Link href="/app" className="hidden px-4 py-2.5 text-[14px] font-medium sm:block">Cancelar</Link> : <button type="button" onClick={() => setPasso(1)} className="px-4 py-2.5 text-[14px] font-medium">Voltar</button>}
            {passo === 1 && <button type="button" onClick={() => setPasso(2)} className="h-11 rounded-[9px] border-[1.5px] border-bordaForte px-3 text-[14px] font-medium hover:border-[#D4D4D4] sm:px-5"><span className="sm:hidden">Arquivos</span><span className="hidden sm:inline">Importar arquivos</span></button>}
            <button type="button" disabled={criando} onClick={criar} className="h-11 rounded-[9px] bg-grafite px-5 text-[14px] font-medium text-fundo hover:bg-[#2a2a2a] disabled:opacity-60">{criando ? 'Criando…' : 'Criar projeto'}</button>
          </div>
        </div>
      </footer>
    </div>
  )
}
