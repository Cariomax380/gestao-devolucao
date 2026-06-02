export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase-server'
import { FiltroPeriodo } from '@/components/layout/FiltroPeriodo'
import { Suspense } from 'react'
import { GraficoTendencia } from './GraficoTendencia'

export default async function TendenciaPage({ searchParams }: { searchParams: Promise<{ periodo?: string }> }) {
  const supabase = await createClient()
  const { periodo } = await searchParams

  const [{ data: semanas }, { data: periodos }] = await Promise.all([
    supabase.rpc('resumo_tendencia_semanal', { p_periodo: periodo ?? null }),
    supabase.rpc('periodos_disponiveis'),
  ])

  const dados = (semanas ?? []).map((r: any) => ({
    semana: String(r.semana),
    fat:    Number(r.fat),
    dev:    Number(r.dev),
    pct:    Number(r.pct),
  }))

  const media = dados.length > 0
    ? dados.reduce((s: number, d: any) => s + d.pct, 0) / dados.length
    : 0

  const totalFat = dados.reduce((s: number, d: any) => s + d.fat, 0)
  const melhorSemana = dados.length ? dados.reduce((min: any, d: any) => d.pct < min.pct ? d : min, dados[0]) : null
  const piorSemana   = dados.length ? dados.reduce((max: any, d: any) => d.pct > max.pct ? d : max, dados[0]) : null

  function fmt(d: string) {
    const dt = new Date(d + 'T12:00:00')
    return `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}`
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-semibold text-lg text-[#003087]">Tendência Semanal</h1>
          <p className="text-gray-500 text-sm mt-0.5">{dados.length} semanas · {totalFat.toLocaleString('pt-BR')} faturados</p>
        </div>
        <Suspense><FiltroPeriodo periodos={periodos ?? []} /></Suspense>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Semanas',       value: dados.length.toString() },
          { label: 'Média % Dev.',  value: `${media.toFixed(2)}%` },
          { label: 'Melhor semana', value: melhorSemana ? `${fmt(melhorSemana.semana)} — ${melhorSemana.pct.toFixed(1)}%` : '—' },
          { label: 'Pior semana',   value: piorSemana   ? `${fmt(piorSemana.semana)} — ${piorSemana.pct.toFixed(1)}%`   : '—' },
        ].map(c => (
          <div key={c.label} className="bg-white border border-gray-100 border-l-4 border-l-[#F2C800] rounded-xl px-4 py-4">
            <p className="text-sm text-gray-500 font-medium mb-1">{c.label}</p>
            <p className="text-lg font-bold text-[#003087]">{c.value}</p>
          </div>
        ))}
      </div>

      {dados.length === 0 ? (
        <div className="bg-[#FFF8DC] border border-[#F2C800]/30 rounded-xl px-4 py-3 text-xs text-gray-500">
          Nenhum dado encontrado. Execute primeiro a RPC <code className="text-[#D4A800]">resumo_tendencia_semanal</code> no Supabase.
        </div>
      ) : (
        <GraficoTendencia dados={dados} media={media} />
      )}
    </div>
  )
}
