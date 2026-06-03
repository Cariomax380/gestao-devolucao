export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase-server'
import { FiltroPeriodo } from '@/components/layout/FiltroPeriodo'
import { Suspense } from 'react'
import { MapaCalor } from './MapaCalor'
import { ErroRPC } from '@/components/layout/ErroRPC'

export type Celula        = { motivo: string; dia: number; qtd: number }
export type CelulaClass   = { classificacao: string; dia: number; qtd: number }
export type CelulaHorario = { faixa: string; dia: number; qtd: number }

const DIAS = ['', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom']

export default async function CalorPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>
}) {
  const supabase = await createClient()
  const { periodo } = await searchParams

  const [
    { data: calor,   error: errCalor },
    { data: classif, error: errClass },
    { data: horario, error: errHora  },
    { data: periodos                 },
  ] = await Promise.all([
    supabase.rpc('resumo_calor_motivo_dia',        { p_periodo: periodo ?? null }),
    supabase.rpc('resumo_calor_classificacao_dia',  { p_periodo: periodo ?? null }),
    supabase.rpc('resumo_calor_horario_dia',        { p_periodo: periodo ?? null }),
    supabase.rpc('periodos_disponiveis'),
  ])

  if (errCalor) return <ErroRPC nome="resumo_calor_motivo_dia" />

  const dados: Celula[] = (calor ?? []).map((r: any) => ({
    motivo: String(r.motivo),
    dia:    Number(r.dia_semana),
    qtd:    Number(r.qtd),
  }))

  // Fallback para [] em caso de RPC ausente no Supabase (evita crash no .map())
  const dadosClass: CelulaClass[] = errClass ? [] : (classif ?? []).map((r: any) => ({
    classificacao: String(r.classificacao),
    dia:           Number(r.dia_semana),
    qtd:           Number(r.qtd),
  }))

  const dadosHorario: CelulaHorario[] = errHora ? [] : (horario ?? []).map((r: any) => ({
    faixa: String(r.faixa),
    dia:   Number(r.dia_semana),
    qtd:   Number(r.qtd),
  }))

  /* ── KPIs ───────────────────────────────────────── */
  const totalDev = dados.reduce((s, d) => s + d.qtd, 0)
  const motivos  = [...new Set(dados.map(d => d.motivo))]

  // Totais por dia (coluna)
  const totalPorDia = [1,2,3,4,5,6,7].map(dia => ({
    dia,
    qtd: dados.filter(d => d.dia === dia).reduce((s, d) => s + d.qtd, 0),
  }))
  const piorDia = totalPorDia.length
    ? totalPorDia.reduce((mx, d) => d.qtd > mx.qtd ? d : mx, totalPorDia[0])
    : null

  // Totais por motivo (linha)
  const totalPorMotivo = motivos.map(m => ({
    motivo: m,
    qtd: dados.filter(d => d.motivo === m).reduce((s, d) => s + d.qtd, 0),
  }))
  const piorMotivo = totalPorMotivo.length
    ? totalPorMotivo.reduce((mx, d) => d.qtd > mx.qtd ? d : mx, totalPorMotivo[0])
    : null

  // Concentracao: top 3 células / total
  const top3Qtd  = [...dados].sort((a, b) => b.qtd - a.qtd).slice(0, 3).reduce((s, d) => s + d.qtd, 0)
  const concentr = totalDev > 0 ? Math.round((top3Qtd / totalDev) * 100) : 0

  type KPI = { label: string; value: string; sub?: string }
  const kpis: KPI[] = [
    { label: 'Total devoluções', value: totalDev.toLocaleString('pt-BR') },
    { label: 'Motivos únicos',   value: motivos.length.toString() },
    {
      label: 'Pior dia',
      value: piorDia && piorDia.qtd > 0 ? DIAS[piorDia.dia] : '—',
      sub:   piorDia && piorDia.qtd > 0 ? `${piorDia.qtd.toLocaleString('pt-BR')} dev.` : undefined,
    },
    {
      label: 'Pior motivo',
      value: piorMotivo ? piorMotivo.motivo.split(' ').slice(0, 3).join(' ') : '—',
      sub:   piorMotivo ? `${piorMotivo.qtd.toLocaleString('pt-BR')} dev.` : undefined,
    },
    {
      label: 'Concentracao top 3',
      value: `${concentr}%`,
      sub:   'das 3 celulas com mais dev.',
    },
  ]

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-semibold text-lg text-[#003087]">Mapa de Calor</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Concentração de devoluções por motivo e dia da semana
          </p>
        </div>
        <Suspense><FiltroPeriodo periodos={periodos ?? []} /></Suspense>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {kpis.map(c => (
          <div
            key={c.label}
            className="bg-white border border-gray-100 border-l-4 border-l-[#F2C800] rounded-xl px-4 py-4"
          >
            <p className="text-xs text-gray-500 font-medium mb-1 leading-tight">{c.label}</p>
            <p className="text-lg font-bold text-[#003087] truncate">{c.value}</p>
            {c.sub && <p className="text-xs text-gray-400 mt-0.5">{c.sub}</p>}
          </div>
        ))}
      </div>

      {dados.length === 0 ? (
        <div className="bg-[#FFF8DC] border border-[#F2C800]/30 rounded-xl px-4 py-3 text-xs text-gray-500">
          Nenhum dado encontrado. Execute a RPC{' '}
          <code className="text-[#D4A800]">resumo_calor_motivo_dia</code> no Supabase.
        </div>
      ) : (
        <MapaCalor dados={dados} dadosClass={dadosClass} dadosHorario={dadosHorario} />
      )}
    </div>
  )
}
