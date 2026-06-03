export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase-server'
import { FiltroPeriodo } from '@/components/layout/FiltroPeriodo'
import { Suspense } from 'react'
import { GraficoTendencia } from './GraficoTendencia'
import { ErroRPC } from '@/components/layout/ErroRPC'

export type Semana = {
  semana: string; fat: number; dev: number; pct: number; tendencia?: number
}
export type SemanaReversao = {
  semana: string; qtd_rev: number; qtd_dev: number; pct_reversao: number; tendencia?: number
}
export type MesResumo = {
  mes: string; fat: number; dev: number; pct: number
}
export type MesReversao = {
  mes: string; qtd_rev: number; qtd_dev: number; pct_reversao: number
}

/* ── helpers ─────────────────────────────────────────── */
function regressao<T extends { tendencia?: number }>(
  arr: T[],
  getY: (d: T) => number,
): void {
  const n = arr.length
  if (n < 2) return
  const xs    = arr.map((_, i) => i)
  const ys    = arr.map(getY)
  const sumX  = xs.reduce((s, x) => s + x, 0)
  const sumY  = ys.reduce((s, y) => s + y, 0)
  const sumXY = xs.reduce((s, x, i) => s + x * ys[i], 0)
  const sumX2 = xs.reduce((s, x) => s + x * x, 0)
  const slope     = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
  const intercept = (sumY - slope * sumX) / n
  arr.forEach((d, i) => { d.tendencia = Math.max(0, intercept + slope * i) })
}

function mediaArr(arr: number[]) {
  return arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0
}

function fmt(d: string) {
  const dt = new Date(d + 'T12:00:00')
  return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}`
}

export default async function TendenciaPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>
}) {
  const supabase = await createClient()
  const { periodo } = await searchParams

  const [
    { data: semanas,   error: errSemanas   },
    { data: reversoesR                     },
    { data: periodos                       },
  ] = await Promise.all([
    supabase.rpc('resumo_tendencia_semanal',           { p_periodo: periodo ?? null }),
    supabase.rpc('resumo_tendencia_reversao_semanal',  { p_periodo: periodo ?? null }),
    supabase.rpc('periodos_disponiveis'),
  ])

  if (errSemanas) return <ErroRPC nome="resumo_tendencia_semanal" />

  /* ── Devolução ──────────────────────────────────────── */
  const dados: Semana[] = (semanas ?? []).map((r: any) => ({
    semana: String(r.semana),
    fat:    Number(r.fat),
    dev:    Number(r.dev),
    pct:    Number(r.pct),
  }))

  const n        = dados.length
  const media    = mediaArr(dados.map(d => d.pct))
  const totalFat = dados.reduce((s, d) => s + d.fat, 0)
  const totalDev = dados.reduce((s, d) => s + d.dev, 0)

  const melhorDev = n ? dados.reduce((m, d) => d.pct < m.pct ? d : m, dados[0]) : null
  const piorDev   = n ? dados.reduce((m, d) => d.pct > m.pct ? d : m, dados[0]) : null

  const ult4Dev  = dados.slice(-4)
  const prev4Dev = dados.slice(-8, -4)
  const mediaUlt4Dev  = mediaArr(ult4Dev.map(d => d.pct))
  const mediaPrev4Dev = mediaArr(prev4Dev.map(d => d.pct))
  const deltaDev      = mediaUlt4Dev - mediaPrev4Dev // + = piorando

  regressao(dados, d => d.pct)

  const porMes: Record<string, { fat: number; dev: number }> = {}
  for (const d of dados) {
    const mes = d.semana.slice(0, 7)
    if (!porMes[mes]) porMes[mes] = { fat: 0, dev: 0 }
    porMes[mes].fat += d.fat
    porMes[mes].dev += d.dev
  }
  const dadosMensais: MesResumo[] = Object.entries(porMes)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, v]) => ({
      mes,
      fat: v.fat,
      dev: v.dev,
      pct: v.fat > 0 ? Math.round((v.dev / v.fat) * 1000) / 10 : 0,
    }))

  /* ── Reversão ───────────────────────────────────────── */
  const dadosRev: SemanaReversao[] = (reversoesR ?? []).map((r: any) => ({
    semana:      String(r.semana),
    qtd_rev:     Number(r.qtd_rev),
    qtd_dev:     Number(r.qtd_dev),
    pct_reversao: Number(r.pct_reversao),
  }))

  const nRev        = dadosRev.length
  const mediaRev    = mediaArr(dadosRev.map(d => d.pct_reversao))
  const totalRev    = dadosRev.reduce((s, d) => s + d.qtd_rev, 0)

  const melhorRev = nRev ? dadosRev.reduce((m, d) => d.pct_reversao > m.pct_reversao ? d : m, dadosRev[0]) : null
  const piorRev   = nRev ? dadosRev.reduce((m, d) => d.pct_reversao < m.pct_reversao ? d : m, dadosRev[0]) : null

  const ult4Rev  = dadosRev.slice(-4)
  const prev4Rev = dadosRev.slice(-8, -4)
  const mediaUlt4Rev  = mediaArr(ult4Rev.map(d => d.pct_reversao))
  const mediaPrev4Rev = mediaArr(prev4Rev.map(d => d.pct_reversao))
  const deltaRev      = mediaUlt4Rev - mediaPrev4Rev // + = melhorando (INVERSO)

  regressao(dadosRev, d => d.pct_reversao)

  const porMesRev: Record<string, { qtd_rev: number; qtd_dev: number }> = {}
  for (const d of dadosRev) {
    const mes = d.semana.slice(0, 7)
    if (!porMesRev[mes]) porMesRev[mes] = { qtd_rev: 0, qtd_dev: 0 }
    porMesRev[mes].qtd_rev += d.qtd_rev
    porMesRev[mes].qtd_dev += d.qtd_dev
  }
  const dadosMensaisRev: MesReversao[] = Object.entries(porMesRev)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, v]) => ({
      mes,
      qtd_rev: v.qtd_rev,
      qtd_dev: v.qtd_dev,
      pct_reversao:
        v.qtd_rev + v.qtd_dev > 0
          ? Math.round((v.qtd_rev / (v.qtd_rev + v.qtd_dev)) * 1000) / 10
          : 0,
    }))

  /* ── KPIs (devolução) ───────────────────────────────── */
  type KPI = {
    label: string; value: string; borderColor: string; valueColor: string
    sub?: string; subColor?: string
  }

  const kpis: KPI[] = [
    {
      label: 'Semanas', value: n.toString(),
      borderColor: '#F2C800', valueColor: '#003087',
    },
    {
      label: 'Total Devolvidos', value: totalDev.toLocaleString('pt-BR'),
      borderColor: '#0057A8', valueColor: '#003087',
    },
    {
      label: 'Média % Dev.', value: `${media.toFixed(2)}%`,
      borderColor: '#F2C800', valueColor: '#003087',
    },
    {
      label: 'Tend. últ. 4 sem.',
      value: `${mediaUlt4Dev.toFixed(1)}%`,
      borderColor: deltaDev > 0.2 ? '#EF4444' : deltaDev < -0.2 ? '#10B981' : '#9CA3AF',
      valueColor:  deltaDev > 0.2 ? '#DC2626' : deltaDev < -0.2 ? '#059669' : '#374151',
      sub: prev4Dev.length
        ? `${deltaDev > 0 ? '↑' : deltaDev < 0 ? '↓' : '→'} ${deltaDev >= 0 ? '+' : ''}${deltaDev.toFixed(1)}pp vs 4 sem. ant.`
        : undefined,
      subColor: deltaDev > 0.2 ? '#EF4444' : deltaDev < -0.2 ? '#10B981' : '#9CA3AF',
    },
    {
      label: 'Melhor semana',
      value: melhorDev ? `${fmt(melhorDev.semana)} — ${melhorDev.pct.toFixed(1)}%` : '—',
      borderColor: '#10B981', valueColor: '#059669',
    },
    {
      label: 'Pior semana',
      value: piorDev ? `${fmt(piorDev.semana)} — ${piorDev.pct.toFixed(1)}%` : '—',
      borderColor: '#EF4444', valueColor: '#DC2626',
    },
  ]

  /* ── KPIs (reversão) ────────────────────────────────── */
  const kpisRev: KPI[] = [
    {
      label: 'Semanas c/ reversão', value: nRev.toString(),
      borderColor: '#7c3aed', valueColor: '#6d28d9',
    },
    {
      label: 'Total Revertidos', value: totalRev.toLocaleString('pt-BR'),
      borderColor: '#7c3aed', valueColor: '#6d28d9',
    },
    {
      label: 'Média % Reversão', value: `${mediaRev.toFixed(2)}%`,
      borderColor: '#7c3aed', valueColor: '#6d28d9',
    },
    {
      label: 'Tend. últ. 4 sem.',
      value: `${mediaUlt4Rev.toFixed(1)}%`,
      // para reversão: delta positivo = MELHORANDO
      borderColor: deltaRev > 0.2 ? '#10B981' : deltaRev < -0.2 ? '#EF4444' : '#9CA3AF',
      valueColor:  deltaRev > 0.2 ? '#059669' : deltaRev < -0.2 ? '#DC2626' : '#374151',
      sub: prev4Rev.length
        ? `${deltaRev > 0 ? '↑' : deltaRev < 0 ? '↓' : '→'} ${deltaRev >= 0 ? '+' : ''}${deltaRev.toFixed(1)}pp vs 4 sem. ant.`
        : undefined,
      subColor: deltaRev > 0.2 ? '#10B981' : deltaRev < -0.2 ? '#EF4444' : '#9CA3AF',
    },
    {
      label: 'Melhor semana',
      value: melhorRev ? `${fmt(melhorRev.semana)} — ${melhorRev.pct_reversao.toFixed(1)}%` : '—',
      borderColor: '#10B981', valueColor: '#059669',
    },
    {
      label: 'Pior semana',
      value: piorRev ? `${fmt(piorRev.semana)} — ${piorRev.pct_reversao.toFixed(1)}%` : '—',
      borderColor: '#EF4444', valueColor: '#DC2626',
    },
  ]

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-semibold text-lg text-[#003087]">Tendência Semanal</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {n} semanas · {totalFat.toLocaleString('pt-BR')} faturados
          </p>
        </div>
        <Suspense><FiltroPeriodo periodos={periodos ?? []} /></Suspense>
      </div>

      {dados.length === 0 ? (
        <div className="bg-[#FFF8DC] border border-[#F2C800]/30 rounded-xl px-4 py-3 text-xs text-gray-500">
          Nenhum dado encontrado. Execute a RPC{' '}
          <code className="text-[#D4A800]">resumo_tendencia_semanal</code> no Supabase.
        </div>
      ) : (
        <GraficoTendencia
          kpisDev={kpis}
          kpisRev={kpisRev}
          dados={dados}
          media={media}
          dadosMensais={dadosMensais}
          dadosRev={dadosRev}
          mediaRev={mediaRev}
          dadosMensaisRev={dadosMensaisRev}
        />
      )}
    </div>
  )
}
