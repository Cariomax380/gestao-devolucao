'use client'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useTransition } from 'react'

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

function formatLabel(periodo: string) {
  const [ano, mes] = periodo.split('-')
  return `${MESES[parseInt(mes) - 1]} ${ano}`
}

export function FiltroMes({ periodos }: { periodos: { periodo: string }[] }) {
  const router   = useRouter()
  const pathname = usePathname()
  const params   = useSearchParams()
  const [, startTransition] = useTransition()

  const atual = params.get('periodo') ?? ''

  const meses = periodos
    .map(p => p.periodo)
    .filter(p => p?.length === 7)
    .sort()
    .reverse()

  function handleChange(value: string) {
    const p = new URLSearchParams(params.toString())
    if (value) p.set('periodo', value)
    else p.delete('periodo')
    startTransition(() => router.replace(`${pathname}?${p.toString()}`))
  }

  if (!meses.length) return null

  return (
    <select
      value={atual}
      onChange={e => handleChange(e.target.value)}
      className="bg-white border border-gray-200 text-[#111111] text-sm rounded-lg px-3 py-1.5 focus:border-[#F2C800] focus:outline-none"
    >
      {meses.map(m => (
        <option key={m} value={m}>{formatLabel(m)}</option>
      ))}
    </select>
  )
}
