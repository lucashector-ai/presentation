'use client'
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { CheckCircle2, Info, TriangleAlert, X } from 'lucide-react'

type Tipo = 'info' | 'sucesso' | 'erro'
interface Toast { id: number; tipo: Tipo; texto: string; acao?: { rotulo: string; aoClicar: () => void } }

const Ctx = createContext<{ mostrar: (texto: string, tipo?: Tipo, acao?: Toast['acao']) => void } | null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [lista, setLista] = useState<Toast[]>([])
  const seq = useRef(0)
  const fechar = useCallback((id: number) => setLista((l) => l.filter((t) => t.id !== id)), [])
  const mostrar = useCallback(
    (texto: string, tipo: Tipo = 'info', acao?: Toast['acao']) => {
      const id = ++seq.current
      setLista((l) => [...l.slice(-3), { id, tipo, texto, acao }])
      setTimeout(() => fechar(id), tipo === 'erro' ? 8000 : 4000)
    },
    [fechar]
  )
  const valor = useMemo(() => ({ mostrar }), [mostrar])
  return (
    <Ctx.Provider value={valor}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4">
        {lista.map((t) => (
          <div key={t.id} role="status" className="pointer-events-auto flex max-w-md items-center gap-3 rounded-xl border bg-superficie px-4 py-3 text-sm shadow-suave">
            {t.tipo === 'sucesso' ? <CheckCircle2 className="h-4 w-4 text-sucesso" /> : t.tipo === 'erro' ? <TriangleAlert className="h-4 w-4 text-perigo" /> : <Info className="h-4 w-4 text-texto2" />}
            <span className="flex-1">{t.texto}</span>
            {t.acao && (
              <button onClick={() => { t.acao?.aoClicar(); fechar(t.id) }} className="font-medium underline-offset-2 hover:underline">
                {t.acao.rotulo}
              </button>
            )}
            <button aria-label="Fechar aviso" onClick={() => fechar(t.id)} className="rounded p-1 text-texto2 hover:bg-superficie2">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}

export function useToast() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useToast precisa do ToastProvider')
  return c
}
