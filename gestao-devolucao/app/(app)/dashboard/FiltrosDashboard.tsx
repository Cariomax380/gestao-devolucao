'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'

interface Props {
  periodos: { periodo: string; cdd: string }[]
  motoristas: { codigo: string; nome: string }[]
  motivos: string[]
}

export function FiltrosDashboard({ periodos, motoristas, motivos }: Props) {
  const router   = useRouter()
  const pathname = usePathname()
  const params   = useSearchParams()

  const set = useCallback((key: string, value: string) => {
    const p = new URLSearchParams(params.toString())
    if (value) p.set(key, value)
    else p.delete(key)
    // Se escolheu período, limpa datas e vice-versa
    if (key === 'periodo') { p.delete('data_inicio'); p.delete('data_fim') }
    if (key === 'data_inicio' || key === 'data_fim') p.delete('periodo')
    router.push(`${pathname}?${p.toString()}`)
  }, [params, pathname, router])

  const sel = (key: string) => params.get(key) ?? ''

  const selectCls = 'bg-[#0a0a0a] border border-white/10 text-gray-300 text-xs rounded-md px-2 py-1.5 focus:border-[#C9A84C]/50 focus:outline-none w-full min-w-0'
  const inputCls  = 'bg-[#0a0a0a] border border-white/10 text-gray-300 text-xs rounded-md px-2 py-1.5 focus:border-[#C9A84C]/50 focus:outline-none w-full min-w-0'

  return (
    <div className="bg-[#141414] border border-white/5 rounded-lg px-3 py-2 space-y-2">
      {/* Linha 1: datas */}
      <div className="grid grid-cols-3 gap-2">
        <div className="min-w-0">
          <label className="text-gray-600 text-[10px] mb-0.5 block">Período</label>
          <select value={sel('periodo')} onChange={e => set('periodo', e.target.value)} className={selectCls}>
            <option value="">Todos</option>
            {periodos.map(p => (
              <option key={p.periodo} value={p.periodo}>
                {new Date(p.periodo + '-15').toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-0">
          <label className="text-gray-600 text-[10px] mb-0.5 block">Data início</label>
          <input type="date" value={sel('data_inicio')} onChange={e => set('data_inicio', e.target.value)} className={inputCls} />
        </div>
        <div className="min-w-0">
          <label className="text-gray-600 text-[10px] mb-0.5 block">Data fim</label>
          <input type="date" value={sel('data_fim')} onChange={e => set('data_fim', e.target.value)} className={inputCls} />
        </div>
      </div>

      {/* Linha 2: motorista, motivo, limpar */}
      <div className="grid grid-cols-3 gap-2">
        <div className="min-w-0">
          <label className="text-gray-600 text-[10px] mb-0.5 block">Motorista</label>
          <select value={sel('motorista')} onChange={e => set('motorista', e.target.value)} className={selectCls}>
            <option value="">Todos</option>
            {motoristas.map(m => (
              <option key={m.codigo} value={m.codigo}>{m.nome}</option>
            ))}
          </select>
        </div>
        <div className="min-w-0">
          <label className="text-gray-600 text-[10px] mb-0.5 block">Motivo</label>
          <select value={sel('motivo')} onChange={e => set('motivo', e.target.value)} className={selectCls}>
            <option value="">Todos</option>
            {motivos.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div className="min-w-0 flex items-end">
          <button
            onClick={() => router.push(pathname)}
            className="w-full py-1.5 text-xs text-gray-500 hover:text-[#C9A84C] border border-white/10 hover:border-[#C9A84C]/30 rounded-md transition-all"
          >
            Limpar filtros
          </button>
        </div>
      </div>
    </div>
  )
}
