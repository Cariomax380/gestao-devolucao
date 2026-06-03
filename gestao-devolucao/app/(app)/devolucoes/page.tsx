export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase-server'
import { formatPct, formatHL } from '@/lib/utils'
import { FiltroPeriodo } from '@/components/layout/FiltroPeriodo'
import { Suspense } from 'react'

export default async function DevolucoesPage({ searchParams }: { searchParams: Promise<{ periodo?: string }> }) {
  const supabase = await createClient()
  const { periodo } = await searchParams
  const p = periodo ?? null

  const [{ data: resumo }, { data: porData }, { data: periodos }] = await Promise.all([
    supabase.rpc('resumo_dashboard', { p_periodo: p }),
    supabase.rpc('resumo_por_data',  { p_periodo: p }),
    supabase.rpc('periodos_disponiveis'),
  ])

  const t    = resumo?.[0] ?? {}
  const fat  = Number(t.pdvs_faturados  ?? 0)
  const dev  = Number(t.pdvs_devolvidos ?? 0)
  const vfat = Number(t.vol_faturado    ?? 0)
  const vdev = Number(t.vol_devolvido   ?? 0)

  const dadosDiarios = (porData ?? []).map((r: any) => ({
    data: r.data_rota as string,
    fat:  Number(r.fat),
    dev:  Number(r.dev),
  }))
  const maxDev = Math.max(...dadosDiarios.map(d => d.dev), 1)

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Devoluções</h1>
          <p className="text-gray-500 text-sm mt-1">{dev.toLocaleString('pt-BR')} devoluções no período</p>
        </div>
        <Suspense><FiltroPeriodo periodos={periodos ?? []} /></Suspense>
      </div>

      {/* KPIs resumidos */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'PDVs Faturados',  value: fat.toLocaleString('pt-BR'),                    cor: 'branco' },
          { label: 'PDVs Devolvidos', value: dev.toLocaleString('pt-BR'),                    cor: 'dourado' },
          { label: 'Devolução PDV%',  value: formatPct(fat > 0 ? dev/fat*100 : null, 2),    cor: 'dourado' },
          { label: 'Vol. Dev. HL',    value: formatHL(vdev),                                 cor: 'dourado' },
          { label: 'Devolução HL%',   value: formatPct(vfat > 0 ? vdev/vfat*100 : null, 2), cor: 'dourado' },
        ].map(c => (
          <div key={c.label} className="bg-[#141414] border border-white/5 rounded-xl p-5">
            <p className="text-gray-500 text-xs uppercase tracking-wider mb-2">{c.label}</p>
            <p className={`text-2xl font-bold ${c.cor === 'dourado' ? 'text-[#C9A84C]' : 'text-white'}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Evolução diária detalhada */}
      <div className="bg-[#141414] border border-white/5 rounded-xl p-6">
        <h2 className="text-white font-semibold mb-6">Evolução diária</h2>
        <div className="space-y-2">
          {dadosDiarios.map(({ data, fat: f, dev: d }) => (
            <div key={data} className="flex items-center gap-3 text-xs">
              <span className="text-gray-500 w-24 shrink-0">
                {new Date(data + 'T12:00:00').toLocaleDateString('pt-BR')}
              </span>
              <div className="flex-1 bg-white/5 rounded-full h-2 overflow-hidden">
                <div className="h-full bg-[#C9A84C] rounded-full" style={{ width: `${(d / maxDev) * 100}%` }} />
              </div>
              <span className="text-white w-8 text-right font-semibold">{d}</span>
              <span className="text-gray-500 w-16 text-right">{formatPct(f > 0 ? d/f*100 : null)}</span>
              <span className="text-gray-600 w-16 text-right">{f.toLocaleString('pt-BR')} fat.</span>
            </div>
          ))}
          {dadosDiarios.length === 0 && (
            <p className="text-gray-600 text-sm text-center py-8">Nenhum dado encontrado</p>
          )}
        </div>
      </div>
    </div>
  )
}
