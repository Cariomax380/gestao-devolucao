export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase-server'
import { FiltroPeriodo } from '@/components/layout/FiltroPeriodo'
import { Suspense } from 'react'
import { getMotoristaMap, resolveMotorista } from '@/lib/motoristas'
import { OfensoresClient } from './OfensoresClient'
import { ErroRPC } from '@/components/layout/ErroRPC'

function calcZScores(valores: number[]) {
  if (valores.length === 0) return { mean: 0, std: 1 }
  const n    = valores.length
  const mean = valores.reduce((s, v) => s + v, 0) / n
  const std  = Math.sqrt(valores.reduce((s, v) => s + (v - mean) ** 2, 0) / n) || 1
  return { mean, std }
}

export default async function OfensoresPage({ searchParams }: { searchParams: Promise<{ periodo?: string; tab?: string }> }) {
  const supabase = await createClient()
  const { periodo, tab } = await searchParams

  // Período efetivo (URL param ou mais recente)
  const { data: periodos } = await supabase.rpc('periodos_disponiveis')
  const periodoEfetivo: string | null = periodo ?? (periodos?.[0]?.periodo ?? null)

  const [
    { data: ofensoresRaw, error: errOfensores },
    { data: pdvsForaRaw },
    { data: reincidentesRaw },
    { data: reincAgg },
    motMap,
  ] = await Promise.all([
    supabase.rpc('resumo_ofensores', { p_periodo: periodoEfetivo }),
    supabase
      .from('devolucoes')
      .select('motorista, codigo_pdv, cliente, motivo, pdvs_devolvidos')
      .eq('dentro_raio', false)
      .gt('pdvs_devolvidos', 0)
      // LIKE para suportar filtro por ano (ex: '2026') e por mês (ex: '2026-05')
      .like('periodo', periodoEfetivo ? `${periodoEfetivo}%` : '%')
      .range(0, 9999),
    supabase.rpc('resumo_pdvs_reincidentes', { p_periodo: periodoEfetivo }),
    supabase.rpc('resumo_reincidencia',      { p_periodo: periodoEfetivo }),
    getMotoristaMap(),
  ])

  if (errOfensores) return <ErroRPC nome="resumo_ofensores" />

  // ── Loop único sobre pdvsForaRaw: soma devoluções + agrupa por motorista ──
  const sumDevFora:      Record<string, number>   = {}
  const pdvsPorMotorista: Record<string, { codigo_pdv: string; cliente: string; motivo: string; qtd: number }[]> = {}

  for (const r of pdvsForaRaw ?? []) {
    const cod = String(r.motorista ?? '').trim()
    if (!cod) continue

    // soma de devoluções fora do raio
    sumDevFora[cod] = (sumDevFora[cod] ?? 0) + Number(r.pdvs_devolvidos ?? 1)

    // agrupamento por PDV
    if (!pdvsPorMotorista[cod]) pdvsPorMotorista[cod] = []
    const ex = pdvsPorMotorista[cod].find(p => p.codigo_pdv === r.codigo_pdv)
    if (ex) {
      ex.qtd += Number(r.pdvs_devolvidos ?? 1)
      if (!ex.motivo && r.motivo) ex.motivo = r.motivo
    } else {
      pdvsPorMotorista[cod].push({
        codigo_pdv: r.codigo_pdv ?? '—',
        cliente:    r.cliente    ?? '—',
        motivo:     r.motivo     ?? '',
        qtd: 1,
      })
    }
  }
  // ordena por qtd desc dentro de cada motorista
  for (const cod of Object.keys(pdvsPorMotorista)) {
    pdvsPorMotorista[cod].sort((a, b) => b.qtd - a.qtd)
  }

  // ── Motoristas ────────────────────────────────────────────────────────────
  const motoristas = (ofensoresRaw ?? [])
    .map((r: any) => {
      const cod      = String(r.motorista ?? '').trim()
      const nome     = resolveMotorista(motMap, cod)
      const fat      = Number(r.fat)
      const dev      = Number(r.dev)
      const devFora = sumDevFora[cod] ?? 0  // devoluções fora do raio
      return {
        motorista: cod,
        nome,
        fat,
        dev,
        fora_raio: Number(r.fora_raio),
        total:     Number(r.total),
        dev_fora:  devFora,
        pct_dev:   fat > 0 ? dev     / fat * 100 : 0,
        pct_fora:  fat > 0 ? devFora / fat * 100 : 0, // apenas devoluções fora do raio
      }
    })
    .filter((m: any) => m.fat >= 5 && m.nome !== 'Sem motorista' && m.motorista !== '')
    .sort((a: any, b: any) => b.pct_dev - a.pct_dev)

  const statDev  = calcZScores(motoristas.map(m => m.pct_dev))
  const statFora = calcZScores(motoristas.map(m => m.pct_fora))
  const motoristasComScore = motoristas.map(m => ({
    ...m,
    score: 0.65 * ((m.pct_dev  - statDev.mean)  / statDev.std)
         + 0.35 * ((m.pct_fora - statFora.mean) / statFora.std),
  }))

  const maxPctDev = Math.max(...motoristas.map(m => m.pct_dev), 0.01)

  // ── pdvForaInfo: codigo_pdv → lista de motoristas que visitaram fora ──
  const pdvForaInfo: Record<string, { motorista: string; nome: string; qtd: number }[]> = {}
  for (const [cod, pdvs] of Object.entries(pdvsPorMotorista)) {
    const nome = resolveMotorista(motMap, cod)
    for (const pdv of pdvs) {
      if (!pdvForaInfo[pdv.codigo_pdv]) pdvForaInfo[pdv.codigo_pdv] = []
      const ex = pdvForaInfo[pdv.codigo_pdv].find(i => i.motorista === cod)
      if (ex) ex.qtd += pdv.qtd
      else pdvForaInfo[pdv.codigo_pdv].push({ motorista: cod, nome, qtd: pdv.qtd })
    }
  }

  // ── Ranking fora do raio — apenas devoluções fora do raio ─────────────
  const rankingFora = [...motoristas]
    .filter(m => m.dev_fora > 0)
    .sort((a, b) => b.pct_fora - a.pct_fora)
    .map(m => ({ motorista: m.motorista, nome: m.nome, dev_fora: m.dev_fora, fat: m.fat, pct_fora: m.pct_fora }))

  const maxPctFora = Math.max(...rankingFora.map(m => m.pct_fora), 0.01)

  // ── Pareto motivos fora do raio ────────────────────────────────────────
  const aggMotivo: Record<string, number> = {}
  for (const r of pdvsForaRaw ?? []) {
    const m = (r.motivo as string) || 'Não informado'
    aggMotivo[m] = (aggMotivo[m] ?? 0) + 1
  }
  const totalFora  = Object.values(aggMotivo).reduce((s, v) => s + v, 0)
  const maxQtdFora = Math.max(...Object.values(aggMotivo), 1)
  let acumFora = 0
  const paretoFora = Object.entries(aggMotivo)
    .sort((a, b) => b[1] - a[1])
    .map(([motivo, qtd]) => {
      acumFora += qtd
      return { motivo, qtd, pct: totalFora > 0 ? qtd / totalFora * 100 : 0, acum: totalFora > 0 ? acumFora / totalFora * 100 : 0 }
    })

  // ── PDVs reincidentes ──────────────────────────────────────────────────
  const reincidentes = (reincidentesRaw ?? []).map((r: any) => ({
    codigo:  String(r.codigo_pdv),
    cliente: String(r.cliente ?? ''),
    dev:     Number(r.total_dev),
    fat:     Number(r.total_fat),
  }))

  // ── Reincidência KPIs ──────────────────────────────────────────────────
  const kpi = reincAgg?.[0] ?? null
  const reincKpi = {
    total:        Number(kpi?.total_pdvs        ?? 0),
    comDev:       Number(kpi?.pdvs_com_devolucao ?? 0),
    reincidentes: Number(kpi?.pdvs_reincidentes  ?? 0),
    taxa:         Number(kpi?.taxa_reincidencia  ?? 0),
  }

  // ── Motoristas com PDVs fora do raio (para filtro) ─────────────────────
  const motoristasComPdvFora = motoristasComScore
    .filter(m => (pdvsPorMotorista[m.motorista]?.length ?? 0) > 0)
    .map(m => ({ cod: m.motorista, nome: m.nome }))

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-semibold text-lg text-[#003087]">Ofensores & PDVs</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {motoristas.length} motoristas · {reincidentes.length} PDVs reincidentes · base ≥ 5 PDVs faturados
          </p>
        </div>
        <Suspense><FiltroPeriodo periodos={periodos ?? []} /></Suspense>
      </div>

      <OfensoresClient
        key={periodoEfetivo ?? 'todos'}
        initialTab={(tab === 'pdvs' ? 'pdvs' : 'motoristas')}
        periodoEfetivo={periodoEfetivo}
        motoristasComScore={motoristasComScore}
        pdvsPorMotorista={pdvsPorMotorista}
        maxPctDev={maxPctDev}
        maxPctFora={maxPctFora}
        paretoFora={paretoFora}
        rankingFora={rankingFora}
        totalFora={totalFora}
        maxQtdFora={maxQtdFora}
        reincidentes={reincidentes}
        reincKpi={reincKpi}
        pdvForaInfo={pdvForaInfo}
        motoristasComPdvFora={motoristasComPdvFora}
      />
    </div>
  )
}
