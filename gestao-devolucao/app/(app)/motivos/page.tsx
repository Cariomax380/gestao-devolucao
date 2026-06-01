export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase-server'
import { formatPct } from '@/lib/utils'

export default async function MotivosPage() {
  const supabase = await createClient()

  const [{ data: motivos }, { data: porCls }] = await Promise.all([
    supabase.rpc('resumo_motivos', { p_periodo: null }),
    supabase.rpc('resumo_por_classificacao', { p_periodo: null }),
  ])

  const ranking = (motivos ?? []).map((r: any) => ({
    motivo: r.motivo ?? 'Não informado',
    cls: r.classificacao ?? '—',
    qtd: Number(r.qtd),
    vol: Number(r.vol),
  }))

  const totalDev = ranking.reduce((s, r) => s + r.qtd, 0)
  const maxQtd = ranking[0]?.qtd ?? 1

  const classificacoes = (porCls ?? []).map((r: any) => ({
    cls: r.classificacao ?? 'Não classificado',
    dev: Number(r.dev),
  })).sort((a, b) => b.dev - a.dev)

  let acumulado = 0
  const pareto = ranking.map(r => {
    acumulado += r.qtd
    return { ...r, pct: totalDev > 0 ? r.qtd / totalDev * 100 : 0, acumPct: totalDev > 0 ? acumulado / totalDev * 100 : 0 }
  })

  function clsColor(cls: string) {
    if (cls === 'Mercado') return '#C9A84C'
    if (cls === 'Logístico') return '#60a5fa'
    if (cls === 'Vendas') return '#f472b6'
    return '#6B7280'
  }

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Motivos e Causa Raiz</h1>
        <p className="text-gray-500 text-sm mt-1">{totalDev.toLocaleString('pt-BR')} devoluções analisadas</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {classificacoes.map(({ cls, dev }) => (
          <div key={cls} className="bg-[#141414] border border-white/5 rounded-xl p-5"
            style={{ borderColor: clsColor(cls) + '30' }}>
            <p className="text-xs uppercase tracking-wider mb-2" style={{ color: clsColor(cls) }}>{cls}</p>
            <p className="text-3xl font-bold text-white">{dev.toLocaleString('pt-BR')}</p>
            <p className="text-gray-500 text-xs mt-1">{formatPct(totalDev > 0 ? dev / totalDev * 100 : null)} do total</p>
          </div>
        ))}
      </div>

      <div className="bg-[#141414] border border-white/5 rounded-xl p-6">
        <h2 className="text-white font-semibold mb-6 sticky top-0 bg-[#141414] z-10 pb-2">Pareto de Motivos</h2>
        <div className="space-y-4 max-h-[32rem] overflow-y-auto pr-1">
          {pareto.map(({ motivo, qtd, cls, pct, acumPct }) => (
            <div key={motivo}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: clsColor(cls) }} />
                  <span className="text-gray-300 text-sm truncate">{motivo}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded shrink-0"
                    style={{ backgroundColor: clsColor(cls) + '20', color: clsColor(cls) }}>{cls}</span>
                </div>
                <div className="flex items-center gap-3 text-sm shrink-0 ml-2">
                  <span className="text-white font-semibold">{qtd.toLocaleString('pt-BR')}</span>
                  <span className="text-[#C9A84C] font-bold w-12 text-right">{formatPct(pct)}</span>
                  <span className="text-gray-600 text-xs w-24 text-right">acum. {formatPct(acumPct)}</span>
                </div>
              </div>
              <div className="bg-white/5 rounded-full h-1.5 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${(qtd / maxQtd) * 100}%`, backgroundColor: clsColor(cls) }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
