export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase-server'
import { FiltroPeriodo } from '@/components/layout/FiltroPeriodo'
import { Suspense } from 'react'
import { MapaCalor } from './MapaCalor'
import { ErroRPC } from '@/components/layout/ErroRPC'

export default async function CalorPage({ searchParams }: { searchParams: Promise<{ periodo?: string }> }) {
  const supabase = await createClient()
  const { periodo } = await searchParams

  const [{ data: calor, error: errCalor }, { data: periodos }] = await Promise.all([
    supabase.rpc('resumo_calor_motivo_dia', { p_periodo: periodo ?? null }),
    supabase.rpc('periodos_disponiveis'),
  ])

  if (errCalor) return <ErroRPC nome="resumo_calor_motivo_dia" />

  const dados = (calor ?? []).map((r: any) => ({
    motivo: String(r.motivo),
    dia:    Number(r.dia_semana),
    qtd:    Number(r.qtd),
  }))

  const totalCelulas  = dados.length
  const totalDev      = dados.reduce((s: number, d: any) => s + d.qtd, 0)
  const motivos       = [...new Set(dados.map((d: any) => d.motivo))]
  const motivoTop     = dados.length
    ? dados.reduce((max: any, d: any) => d.qtd > max.qtd ? d : max, dados[0])
    : null

  const DIAS = ['', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-semibold text-lg text-[#003087]">Mapa de Calor</h1>
          <p className="text-gray-500 text-sm mt-0.5">Motivo × dia da semana — concentração de devoluções</p>
        </div>
        <Suspense><FiltroPeriodo periodos={periodos ?? []} /></Suspense>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total devoluções', value: totalDev.toLocaleString('pt-BR') },
          { label: 'Motivos únicos',   value: motivos.length.toString()        },
          { label: 'Combinações',      value: totalCelulas.toString()          },
          { label: 'Pico',             value: motivoTop ? `${motivoTop.motivo.split(' ')[0]} / ${DIAS[motivoTop.dia]}` : '—' },
        ].map(c => (
          <div key={c.label} className="bg-white border border-gray-100 border-l-4 border-l-[#F2C800] rounded-xl px-4 py-4">
            <p className="text-sm text-gray-500 font-medium mb-1">{c.label}</p>
            <p className="text-lg font-bold text-[#003087] truncate">{c.value}</p>
          </div>
        ))}
      </div>

      {dados.length === 0 ? (
        <div className="bg-[#FFF8DC] border border-[#F2C800]/30 rounded-xl px-4 py-3 text-xs text-gray-500">
          Nenhum dado encontrado. Execute primeiro a RPC <code className="text-[#D4A800]">resumo_calor_motivo_dia</code> no Supabase.
        </div>
      ) : (
        <MapaCalor dados={dados} />
      )}
    </div>
  )
}
