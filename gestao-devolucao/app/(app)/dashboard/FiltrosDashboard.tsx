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
    if (key === 'periodo') { p.delete('data_inicio'); p.delete('data_fim') }
    if (key === 'data_inicio' || key === 'data_fim') p.delete('periodo')
    router.push(`${pathname}?${p.toString()}`)
  }, [params, pathname, router])

  const sel = (key: string) => params.get(key) ?? ''

  const selectCls = 'bg-white border border-gray-200 text-[#111111] text-xs rounded-md px-2 py-1.5 focus:border-[#F2C800] focus:outline-none w-full min-w-0'
  const inputCls  = 'bg-white border border-gray-200 text-[#111111] text-xs rounded-md px-2 py-1.5 focus:border-[#F2C800] focus:outline-none w-full min-w-0'

  return (
    <div className="bg-white border border-gray-100 rounded-lg px-3 py-3 space-y-2">
      {/* Linha 1: datas */}
      <div className="grid grid-cols-3 gap-2">
        <div className="min-w-0">
          <label className="text-gray-500 text-[10px] mb-0.5 block font-medium">Período</label>
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
          <label className="text-gray-500 text-[10px] mb-0.5 block font-medium">Data início</label>
          <input type="date" value={sel('data_inicio')} onChange={e => set('data_inicio', e.target.value)} className={inputCls} />
        </div>
        <div className="min-w-0">
          <label className="text-gray-500 text-[10px] mb-0.5 block font-medium">Data fim</label>
          <input type="date" value={sel('data_fim')} onChange={e => set('data_fim', e.target.value)} className={inputCls} />
        </div>
      </div>

      {/* Linha 2: motorista, motivo, limpar */}
      <div className="grid grid-cols-3 gap-2">
        <div className="min-w-0">
          <label className="text-gray-500 text-[10px] mb-0.5 block font-medium">Motorista</label>
          <select value={sel('motorista')} onChange={e => set('motorista', e.target.value)} className={selectCls}>
            <option value="">Todos</option>
            {motoristas.map(m => (
              <option key={m.codigo} value={m.codigo}>{m.nome}</option>
            ))}
          </select>
        </div>
        <div className="min-w-0">
          <label className="text-gray-500 text-[10px] mb-0.5 block font-medium">Motivo</label>
          <select value={sel('motivo')} onChange={e => set('motivo', e.target.value)} className={selectCls}>
            <option value="">Todos</option>
            {motivos.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div className="min-w-0 flex items-end">
          <button
            onClick={() => router.push(pathname)}
            className="w-full py-1.5 text-xs text-gray-500 hover:text-[#003087] border border-gray-200 hover:border-[#003087] rounded-md transition-all"
          >
            Limpar filtros
          </button>
        </div>
      </div>
    </div>
  )
}
