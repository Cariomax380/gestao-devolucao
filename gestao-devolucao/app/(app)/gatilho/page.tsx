export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase-server'
import { FiltroMes } from '@/app/(app)/variacao/FiltroMes'
import { ErroRPC } from '@/components/layout/ErroRPC'
import { GatilhoClient } from './GatilhoClient'
import { Suspense } from 'react'

export type GatilhoDia = {
  data_rota:   string
  pdvs_fat:    number
  pdvs_dev:    number
  pct_dev:     number
  media_prev:  number
  desvio_prev: number
  periodo_ref: string
}

export type GatilhoMotorista = {
  data_rota:     string
  motorista:     string
  nome_motorista: string
  devs_dia:      number
  fat_dia:       number
  media_prev:    number
  desvio_prev:   number
  periodo_ref:   string
}

export type GatilhoRelato = {
  id:            string
  motorista:     string
  data_rota:     string
  tipo:          'total' | 'fechado' | 'geral'
  status:        'relatado' | 'em_acompanhamento' | 'concluido'
  relato:        string
  responsavel:   string | null
  criado_em:     string
  cinco_porques: string[] | null
  categoria:     string | null
}

function toGatilhoDia(r: any): GatilhoDia {
  return {
    data_rota:   String(r.data_rota),
    pdvs_fat:    Number(r.pdvs_fat),
    pdvs_dev:    Number(r.pdvs_dev),
    pct_dev:     Number(r.pct_dev),
    media_prev:  Number(r.media_prev),
    desvio_prev: Number(r.desvio_prev),
    periodo_ref: String(r.periodo_ref),
  }
}

function toGatilhoMotorista(r: any): GatilhoMotorista {
  return {
    data_rota:      String(r.data_rota),
    motorista:      String(r.motorista),
    nome_motorista: String(r.nome_motorista),
    devs_dia:       Number(r.devs_dia),
    fat_dia:        Number(r.fat_dia),
    media_prev:     Number(r.media_prev),
    desvio_prev:    Number(r.desvio_prev),
    periodo_ref:    String(r.periodo_ref),
  }
}

export default async function GatilhoPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; tab?: string }>
}) {
  const supabase = await createClient()
  const { periodo, tab } = await searchParams
  const p = periodo ?? null

  const [
    { data: geralRaw,   error: errGeral   },
    { data: totalRaw,   error: errTotal   },
    { data: fechadoRaw, error: errFechado },
    { data: periodos },
    { data: relatosRaw },
  ] = await Promise.all([
    supabase.rpc('resumo_gatilho_geral',      { p_periodo: p }),
    supabase.rpc('resumo_gatilho_motoristas', { p_periodo: p, p_tipo: 'total' }),
    supabase.rpc('resumo_gatilho_motoristas', { p_periodo: p, p_tipo: 'pdv_fechado' }),
    supabase.rpc('periodos_disponiveis'),
    supabase
      .from('gatilho_relato')
      .select('id, motorista, data_rota, tipo, status, relato, responsavel, criado_em, cinco_porques, categoria')
      .order('criado_em', { ascending: false }),
  ])

  if (errGeral)   return <ErroRPC nome="resumo_gatilho_geral" />
  if (errTotal)   return <ErroRPC nome="resumo_gatilho_motoristas (total)" />
  if (errFechado) return <ErroRPC nome="resumo_gatilho_motoristas (pdv_fechado)" />

  const geral:   GatilhoDia[]       = (geralRaw   ?? []).map(toGatilhoDia)
  const total:   GatilhoMotorista[] = (totalRaw   ?? []).map(toGatilhoMotorista)
  const fechado: GatilhoMotorista[] = (fechadoRaw ?? []).map(toGatilhoMotorista)

  // Mapa de relatos: chave = `${motorista}|${data_rota}|${tipo}` → relato mais recente
  const relatos: Record<string, GatilhoRelato> = {}
  for (const r of (relatosRaw ?? []) as GatilhoRelato[]) {
    const key = `${r.motorista}|${r.data_rota}|${r.tipo}`
    if (!relatos[key]) relatos[key] = r   // já ordenado por criado_em desc → primeiro = mais recente
  }

  const periodoRef = geral[0]?.periodo_ref ?? total[0]?.periodo_ref ?? null

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-semibold text-lg text-[#003087]">Gestão de Gatilho</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            Gatilho % (frota) e gatilho numérico (motoristas) — μ + N×σ excluindo zeros e outliers P95
            {periodoRef && (
              <span className="text-[#D4A800]"> · Base: {periodoRef}</span>
            )}
          </p>
        </div>
        <Suspense>
          <FiltroMes periodos={periodos ?? []} />
        </Suspense>
      </div>

      <GatilhoClient
        geral={geral}
        total={total}
        fechado={fechado}
        relatos={relatos}
        initialTab={tab ?? 'geral'}
      />
    </div>
  )
}
