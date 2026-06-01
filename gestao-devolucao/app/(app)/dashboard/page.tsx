export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase-server'
import { formatPct, formatHL } from '@/lib/utils'
import { getMotoristaMap } from '@/lib/motoristas'
import { FiltrosDashboard } from './FiltrosDashboard'
import { GraficosTabs } from './GraficosTabs'
import { Suspense } from 'react'

function clsColor(cls: string) {
  if (cls === 'Mercado')   return '#C9A84C'
  if (cls === 'Logístico') return '#60a5fa'
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

  // KPIs
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
    { label: 'PDVs Faturados',    value: fat.toLocaleString('pt-BR'), cor: 'branco'  },
    { label: 'PDVs Devolvidos',   value: dev.toLocaleString('pt-BR'), cor: 'dourado' },
    { label: 'Devolução PDV%',    value: formatPct(pct_dev_pdv),      cor: 'dourado' },
    { label: 'Vol. Faturado HL',  value: formatHL(vfat),              cor: 'branco'  },
    { label: 'Vol. Devolvido HL', value: formatHL(vdev),              cor: 'dourado' },
    { label: 'Devolução HL%',     value: formatPct(pct_dev_hl),       cor: 'dourado' },
    { label: 'Repasses',          value: rep.toLocaleString('pt-BR'), cor: 'branco'  },
    { label: '% Repasse',         value: formatPct(pct_repasse),      cor: 'dourado' },
  ]

  // Dados para os gráficos (já agregados pelo banco)
  const diarios = (porData ?? []).map((r: any) => ({
    data: String(r.data_rota),
    fat:  Number(r.fat),
    dev:  Number(r.dev),
    pct:  Number(r.pct),
  }))

  const motivosData = (porMotivo ?? []).map((r: any) => ({
    motivo: r.motivo as string,
    qtd:    Number(r.qtd),
    pct:    Number(r.pct),
  }))

  const motoristasData = (porMotorista ?? []).map((r: any) => ({
    nome: motMap.get(String(r.motorista).trim()) ?? `#${r.motorista}`,
    fat:  Number(r.fat),
    dev:  Number(r.dev),
    pct:  Number(r.pct),
  }))

  const classificacoesData = (porCls ?? []).map((r: any) => ({
    cls: r.classificacao as string,
    dev: Number(r.dev),
    pct: Number(r.pct),
    cor: clsColor(r.classificacao),
  }))

  const motivosDisponiveis = (motivosDisp ?? []).map((r: any) => r.motivo as string)

  return (
    <div className="p-5 space-y-4">
      {/* Header */}
      <div className="flex items-baseline justify-between">
        <h1 className="text-lg font-bold text-white">Dashboard</h1>
        <p className="text-gray-600 text-xs">{dev.toLocaleString('pt-BR')} dev · {fat.toLocaleString('pt-BR')} fat.</p>
      </div>

      {/* Filtros em linha própria — largura total */}
      <Suspense>
        <FiltrosDashboard
          periodos={periodos ?? []}
          motoristas={(motoristasList ?? []).map((m: any) => ({ codigo: String(m.codigo), nome: m.nome }))}
          motivos={motivosDisponiveis}
        />
      </Suspense>

      {fat === 0 && (
        <div className="bg-[#141414] border border-[#C9A84C]/20 rounded-xl px-4 py-3 text-xs text-gray-400">
          Nenhum dado encontrado. Ajuste os filtros ou importe uma planilha.
        </div>
      )}

      {/* KPIs — 4 por linha, 2 linhas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {kpis.map(card => (
          <div key={card.label} className="bg-[#141414] border border-white/5 rounded-lg px-3 py-3">
            <p className="text-gray-500 text-[10px] uppercase tracking-wide mb-1 leading-tight">{card.label}</p>
            <p className={`text-xl font-bold ${card.cor === 'dourado' ? 'text-[#C9A84C]' : 'text-white'}`}>
              {card.value}
            </p>
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
        />
      </Suspense>
    </div>
  )
}
