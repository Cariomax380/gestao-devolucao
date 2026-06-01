'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'

interface Props {
  periodos: { periodo: string; cdd: string; total_linhas: number }[]
}

export function FiltroPeriodo({ periodos }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const atual = params.get('periodo') ?? ''

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const v = e.target.value
    const p = new URLSearchParams(params.toString())
    if (v) { p.set('periodo', v) } else { p.delete('periodo') }
    router.push(`${pathname}?${p.toString()}`)
  }

  if (!periodos.length) return null

  return (
    <select
      value={atual}
      onChange={onChange}
      className="bg-[#1a1a1a] border border-white/10 text-gray-300 text-sm rounded-lg px-3 py-1.5 focus:border-[#C9A84C]/50 focus:outline-none"
    >
      <option value="">Todos os períodos</option>
      {periodos.map(p => (
        <option key={p.periodo} value={p.periodo}>
          {new Date(p.periodo + '-15').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
          {' '}· CDD {p.cdd}
        </option>
      ))}
    </select>
  )
}
