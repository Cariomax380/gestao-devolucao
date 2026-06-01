'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { salvarMetas } from './actions'

const INDICADORES = [
  { key: 'devolucao_pdv_pct',           label: 'Devolução PDV%',             unidade: '%',   dica: 'Ex: 5 para meta de 5%' },
  { key: 'devolucao_hl_pct',            label: 'Devolução HL%',              unidade: '%',   dica: 'Ex: 3 para meta de 3%' },
  { key: 'reversao_pct',                label: 'Reversão%',                  unidade: '%',   dica: 'Ex: 80 para meta de 80%' },
  { key: 'repasses_apontados_pct',      label: 'Repasses Apontados%',        unidade: '%',   dica: 'Ex: 90 para meta de 90%' },
  { key: 'repasses_efetivos_pct',       label: 'Repasses Efetivos%',         unidade: '%',   dica: 'Ex: 85 para meta de 85%' },
  { key: 'devolucoes_apontadas_pct',    label: 'Dev. Apontadas vs Total%',   unidade: '%',   dica: 'Ex: 70 para meta de 70%' },
  { key: 'aderencia_raio_pct',          label: 'Aderência Raio%',            unidade: '%',   dica: 'Ex: 95 para meta de 95%' },
  { key: 'devolucao_antes_horario_pct', label: 'Dev. Antes Horário%',        unidade: '%',   dica: 'Ex: 60 para meta de 60%' },
  { key: 'tempo_medio_cme',             label: 'Tempo Médio CME',            unidade: 'min', dica: 'Ex: 30 para meta de 30 min' },
  { key: 'tempo_medio_tratativa',       label: 'Tempo Médio Tratativa',      unidade: 'min', dica: 'Ex: 60 para meta de 60 min' },
]

interface Periodo { periodo: string; cdd: string }

interface Props {
  metasAtuais: Record<string, number>
  periodos: Periodo[]
  periodoSelecionado: string
}

export function MetasForm({ metasAtuais, periodos, periodoSelecionado }: Props) {
  const formRef = useRef<HTMLFormElement>(null)
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
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
        setMsg({ tipo: 'ok', texto: `Metas do período "${periodoSelecionado === 'global' ? 'Global' : periodoSelecionado}" salvas!` })
      }
    })
  }

  const inputCls = 'w-full bg-[#0a0a0a] border border-white/10 text-gray-200 text-sm rounded-lg px-3 py-2 text-right focus:border-[#C9A84C]/50 focus:outline-none'

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
      {/* Seletor de período */}
      <div className="bg-[#141414] border border-white/5 rounded-xl p-5">
        <label className="text-gray-500 text-xs mb-2 block uppercase tracking-wider">Período das metas</label>
        <select
          name="periodo"
          value={periodoSelecionado}
          onChange={onPeriodoChange}
          className="w-full bg-[#0a0a0a] border border-white/10 text-gray-200 text-sm rounded-lg px-3 py-2 focus:border-[#C9A84C]/50 focus:outline-none"
        >
          <option value="global">Global (padrão para todos os períodos)</option>
          {periodos.map(p => (
            <option key={p.periodo} value={p.periodo}>
              {new Date(p.periodo + '-15').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
            </option>
          ))}
        </select>
        {periodoSelecionado !== 'global' && (
          <p className="text-xs text-[#C9A84C]/70 mt-2">
            Metas específicas deste período sobrepõem as globais ao filtrar por ele.
          </p>
        )}
      </div>

      {/* Indicadores */}
      {INDICADORES.map(({ key, label, unidade, dica }) => (
        <div key={key} className="bg-[#141414] border border-white/5 rounded-xl p-5 flex items-center gap-6">
          <div className="flex-1 min-w-0">
            <p className="text-gray-200 text-sm font-medium">{label}</p>
            <p className="text-gray-600 text-xs mt-0.5">{dica}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <input
              type="number"
              name={key}
              step="0.01"
              min="0"
              defaultValue={metasAtuais[key] ?? ''}
              placeholder="—"
              className={`w-28 ${inputCls}`}
            />
            <span className="text-gray-500 text-sm w-8">{unidade}</span>
          </div>
        </div>
      ))}

      {msg && (
        <div className={`rounded-xl px-5 py-3 text-sm ${
          msg.tipo === 'ok'
            ? 'bg-green-500/10 border border-green-500/20 text-green-400'
            : 'bg-red-500/10 border border-red-500/20 text-red-400'
        }`}>
          {msg.texto}
        </div>
      )}

      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="bg-[#C9A84C] hover:bg-[#b8933d] disabled:opacity-50 text-black text-sm font-semibold px-6 py-2.5 rounded-lg transition-colors"
        >
          {isPending ? 'Salvando…' : 'Salvar metas'}
        </button>
      </div>
    </form>
  )
}
