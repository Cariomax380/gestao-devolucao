export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase-server'
import { formatPct, formatHL } from '@/lib/utils'
import { getMotoristaMap } from '@/lib/motoristas'
import { FiltrosDashboard } from './FiltrosDashboard'
import { GraficosTabs } from './GraficosTabs'
import { Suspense } from 'react'

function clsColor(cls: string) {
  if (cls === 'Mercado')   return '#F2C800'
  if (cls === 'Logístico') return '#0057A8'
  if (cls === 'Vendas')    return '#f472b6'
  return '#6B7280'
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    periodo?: string
    data_inicio?: string
    data_fim?: string
    motorista?: string
    motivo?: string
  }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const sp = await searchParams

  const params = {
    p_periodo:     sp.periodo     ?? null,
    p_data_inicio: sp.data_inicio ?? null,
    p_data_fim:    sp.data_fim    ?? null,
    p_motorista:   sp.motorista   ?? null,
    p_motivo:      sp.motivo      ?? null,
  }

  const [
    { data: resumo },
    { data: porData },
    { data: porMotivo },
    { data: porMotorista },
    { data: porCls },
    { data: periodos },
    { data: motoristasList },
    { data: motivosDisp },
    motMap,
  ] = await Promise.all([
    supabase.rpc('resumo_dashboard_filtrado',         params),
    supabase.rpc('resumo_por_data_filtrado',          params),
    supabase.rpc('resumo_por_motivo_filtrado',        params),
    supabase.rpc('resumo_por_motorista_filtrado',     params),
    supabase.rpc('resumo_por_classificacao_filtrado', params),
    supabase.rpc('periodos_disponiveis'),
    supabase.from('motoristas').select('codigo,nome').order('nome'),
    supabase.rpc('motivos_disponiveis'),
    getMotoristaMap(),
  ])

  const t    = resumo?.[0] ?? {}
  const fat  = Number(t.pdvs_faturados  ?? 0)
  const dev  = Number(t.pdvs_devolvidos ?? 0)
  const rep  = Number(t.pdv_repasse     ?? 0)
  const vfat = Number(t.vol_faturado    ?? 0)
  const vdev = Number(t.vol_devolvido   ?? 0)

  const pct_dev_pdv = fat > 0  ? dev / fat  * 100 : null
  const pct_dev_hl  = vfat > 0 ? vdev / vfat * 100 : null
  const pct_repasse = (dev + rep) > 0 ? rep / (dev + rep) * 100 : null

  const kpis = [
    { label: 'PDVs Faturados',    value: fat.toLocaleString('pt-BR') },
    { label: 'PDVs Devolvidos',   value: dev.toLocaleString('pt-BR') },
    { label: 'Devolução PDV%',    value: formatPct(pct_dev_pdv, 2)   },
    { label: 'Vol. Faturado HL',  value: formatHL(vfat)              },
    { label: 'Vol. Devolvido HL', value: formatHL(vdev)              },
    { label: 'Devolução HL%',     value: formatPct(pct_dev_hl, 2)    },
    { label: 'Repasses',          value: rep.toLocaleString('pt-BR') },
    { label: '% Repasse',         value: formatPct(pct_repasse, 2)   },
  ]

  // Vista diária quando período é mês específico (YYYY-MM), mensal nos demais casos
  const isMonthFilter = !!(params.p_periodo && params.p_periodo.length === 7)

  const diariosRaw = (porData ?? []).map((r: any) => ({
    data:    String(r.data_rota),
    fat:     Number(r.fat),
    dev:     Number(r.dev),
    vol_fat: Number(r.vol_fat ?? 0),
    vol_dev: Number(r.vol_dev ?? 0),
  }))

  // Agrega por mês quando não é filtro de mês específico
  const diarios = isMonthFilter
    ? diariosRaw.map(d => ({
        ...d,
        pct:    d.fat > 0 ? d.dev / d.fat * 100 : 0,
        pct_hl: d.vol_fat > 0 ? d.vol_dev / d.vol_fat * 100 : 0,
      }))
    : (() => {
        const byMonth: Record<string, { fat: number; dev: number; vol_fat: number; vol_dev: number }> = {}
        for (const d of diariosRaw) {
          const m = d.data.slice(0, 7) // 'YYYY-MM'
          if (!byMonth[m]) byMonth[m] = { fat: 0, dev: 0, vol_fat: 0, vol_dev: 0 }
          byMonth[m].fat     += d.fat
          byMonth[m].dev     += d.dev
          byMonth[m].vol_fat += d.vol_fat
          byMonth[m].vol_dev += d.vol_dev
        }
        return Object.entries(byMonth)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([mes, v]) => ({
            data:    mes,
            fat:     v.fat,
            dev:     v.dev,
            vol_fat: v.vol_fat,
            vol_dev: v.vol_dev,
            pct:    v.fat > 0 ? v.dev / v.fat * 100 : 0,
            pct_hl: v.vol_fat > 0 ? v.vol_dev / v.vol_fat * 100 : 0,
          }))
      })()

  const motivosData = (porMotivo ?? []).map((r: any) => ({
    motivo: r.motivo as string,
    qtd:    Number(r.qtd),
    pct:    Number(r.pct),
  }))

  const motoristasData = (porMotorista ?? []).map((r: any) => ({
    nome:    motMap.get(String(r.motorista).trim()) ?? `#${r.motorista}`,
    fat:     Number(r.fat),
    dev:     Number(r.dev),
    pct:     Number(r.pct),
    vol_fat: Number(r.vol_fat ?? 0),
    vol_dev: Number(r.vol_dev ?? 0),
    pct_hl:  Number(r.pct_hl  ?? 0),
  }))

  const classificacoesData = (porCls ?? []).map((r: any) => ({
    cls: r.classificacao as string,
    dev: Number(r.dev),
    pct: Number(r.pct),
    cor: clsColor(r.classificacao),
  }))

  const motivosDisponiveis = (motivosDisp ?? []).map((r: any) => r.motivo as string)

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-baseline justify-between">
        <h1 className="font-semibold text-lg text-[#003087]">Dashboard</h1>
        <p className="text-gray-500 text-xs">{dev.toLocaleString('pt-BR')} dev · {fat.toLocaleString('pt-BR')} fat.</p>
      </div>

      <Suspense>
        <FiltrosDashboard
          periodos={periodos ?? []}
          motoristas={(motoristasList ?? []).map((m: any) => ({ codigo: String(m.codigo), nome: m.nome }))}
          motivos={motivosDisponiveis}
        />
      </Suspense>

      {fat === 0 && (
        <div className="bg-[#FFF8DC] border border-[#F2C800]/30 rounded-xl px-4 py-3 text-xs text-gray-500">
          Nenhum dado encontrado. Ajuste os filtros ou importe uma planilha.
        </div>
      )}

      {/* KPIs — 4 por linha */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {kpis.map(card => (
          <div key={card.label} className="bg-white border border-gray-100 border-l-4 border-l-[#F2C800] rounded-xl px-4 py-4">
            <p className="text-sm text-gray-500 font-medium mb-1 leading-tight">{card.label}</p>
            <p className="text-2xl font-bold text-[#003087]">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Gráficos */}
      <Suspense>
        <GraficosTabs
          diarios={diarios}
          motivos={motivosData}
          motoristas={motoristasData}
          classificacoes={classificacoesData}
          totalFaturados={fat}
          isMonthly={!isMonthFilter}
        />
      </Suspense>
    </div>
  )
}
