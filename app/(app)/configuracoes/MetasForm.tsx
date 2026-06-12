'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { salvarMetas } from './actions'

const METAS = [
  {
    key:         'devolucao_pdv_pct',
    label:       'Dev. PDV',
    descricao:   'Percentual de PDVs devolvidos sobre o total faturado',
    direcao:     'menor' as const,
    cor:         '#F2C800',
    placeholder: '5.0',
  },
  {
    key:         'devolucao_hl_pct',
    label:       'Dev. HL',
    descricao:   'Percentual de volume devolvido em hectolitros',
    direcao:     'menor' as const,
    cor:         '#0057A8',
    placeholder: '3.0',
  },
  {
    key:         'reversao_pct',
    label:       'Reversão',
    descricao:   'Taxa de devoluções revertidas em repasses',
    direcao:     'maior' as const,
    cor:         '#7c3aed',
    placeholder: '80.0',
  },
]

interface Periodo { periodo: string; cdd: string }

interface Props {
  metasAtuais:       Record<string, number>
  periodos:          Periodo[]
  periodoSelecionado: string
}

export function MetasForm({ metasAtuais, periodos, periodoSelecionado }: Props) {
  const formRef = useRef<HTMLFormElement>(null)
  const router   = useRouter()
  const pathname = usePathname()
  const params   = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  function onPeriodoChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const p = new URLSearchParams(params.toString())
    if (e.target.value) p.set('periodo', e.target.value)
    else p.delete('periodo')
    router.push(`${pathname}?${p.toString()}`)
    setMsg(null)
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    setMsg(null)
    startTransition(async () => {
      const res = await salvarMetas(formData)
      if ('error' in res) {
        setMsg({ tipo: 'erro', texto: res.error! })
      } else {
        const periodo = periodoSelecionado === 'global' ? 'todos os períodos' : periodoSelecionado
        setMsg({ tipo: 'ok', texto: `Metas salvas para "${periodo}".` })
      }
    })
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit}>

      {/* Selector de período */}
      <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between gap-4">
        <p className="text-xs text-gray-400">Aplique as metas a um período específico ou deixe como global.</p>
        <div className="shrink-0 text-right">
          <select
            name="periodo"
            value={periodoSelecionado}
            onChange={onPeriodoChange}
            className="bg-[#F9FAFB] border border-gray-200 text-[#111] text-xs rounded-lg px-3 py-2 focus:border-[#F2C800] focus:outline-none cursor-pointer"
          >
            <option value="global">Global</option>
            {periodos.map(p => (
              <option key={p.periodo} value={p.periodo}>
                {new Date(p.periodo + '-15').toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}
              </option>
            ))}
          </select>
          {periodoSelecionado !== 'global' && (
            <p className="text-[10px] text-[#D4A800] mt-1.5">Sobrepõe o global</p>
          )}
        </div>
      </div>

      {/* Grid de métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-gray-50">
        {METAS.map(({ key, label, descricao, direcao, cor, placeholder }) => (
          <div key={key} className="p-6 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cor }} />
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">{label}</span>
            </div>

            <p className="text-[11px] text-gray-400 leading-relaxed">{descricao}</p>

            <div className="relative">
              <input
                type="number"
                name={key}
                step="0.01"
                min="0"
                max="100"
                defaultValue={metasAtuais[key] ?? ''}
                placeholder={placeholder}
                className="w-full bg-[#F9FAFB] border border-gray-200 text-[#111] text-2xl font-bold rounded-lg pl-4 pr-10 py-3 text-right focus:border-[#F2C800] focus:outline-none transition-colors"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">%</span>
            </div>

            <p className="text-[10px] text-gray-400 flex items-center gap-1">
              {direcao === 'menor' ? (
                <>
                  <svg className="w-3 h-3 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                  Menor é melhor
                </>
              ) : (
                <>
                  <svg className="w-3 h-3 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                  </svg>
                  Maior é melhor
                </>
              )}
            </p>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-gray-50 flex items-center justify-between">
        {msg ? (
          <span className={`text-sm ${msg.tipo === 'ok' ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
            {msg.texto}
          </span>
        ) : <span />}
        <button
          type="submit"
          disabled={isPending}
          className="bg-[#F2C800] hover:bg-[#D4A800] disabled:opacity-50 text-[#003087] text-sm font-semibold px-5 py-2 rounded-lg transition-colors active:scale-[0.98]"
        >
          {isPending ? 'Salvando…' : 'Salvar metas'}
        </button>
      </div>
    </form>
  )
}
