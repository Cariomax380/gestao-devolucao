'use client'

import { useState, useMemo } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import {
  ComposedChart, Bar, Cell, ReferenceLine,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import type { GatilhoDia, GatilhoMotorista } from './page'

interface Props {
  geral:      GatilhoDia[]
  total:      GatilhoMotorista[]
  fechado:    GatilhoMotorista[]
  initialTab: string
}

const TABS = [
  { key: 'geral',   label: 'Devolução Geral %' },
  { key: 'total',   label: 'Dev. Total' },
  { key: 'fechado', label: 'PDV Fechado' },
]

const SIGMAS = [
  { val: 1.0, label: '1σ' },
  { val: 1.5, label: '1.5σ' },
  { val: 2.0, label: '2σ' },
]

function fmtData(d: string) {
  const p = d.split('-')
  return p.length >= 3 ? `${p[2]}/${p[1]}` : d
}

type Zona = 'critica' | 'atencao' | 'normal'

function getZona(valor: number, media: number, desvio: number, sigma: number): Zona {
  if (valor > media + sigma * desvio) return 'critica'
  if (valor > media + desvio)         return 'atencao'
  return 'normal'
}

const ZONA: Record<Zona, { label: string; bg: string; text: string; rowBg: string }> = {
  critica: { label: 'Crítica', bg: '#FEE2E2', text: '#DC2626', rowBg: '#FFF5F5' },
  atencao: { label: 'Atenção', bg: '#FEF3C7', text: '#D97706', rowBg: '#FFFDF0' },
  normal:  { label: 'Normal',  bg: '#D1FAE5', text: '#059669', rowBg: ''        },
}

function ZonaBadge({ zona }: { zona: Zona }) {
  const c = ZONA[zona]
  return (
    <span
      className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide whitespace-nowrap"
      style={{ backgroundColor: c.bg, color: c.text }}
    >
      {c.label}
    </span>
  )
}

function UsoBarra({ valor, gatilho }: { valor: number; gatilho: number }) {
  const pct   = gatilho > 0 ? Math.round((valor / gatilho) * 100) : 0
  const clamp = Math.min(pct, 100)
  const cor   = pct >= 100 ? '#EF4444' : pct >= 70 ? '#F59E0B' : '#10B981'
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 bg-gray-100 rounded-full h-1.5 overflow-hidden shrink-0">
        <div className="h-full rounded-full" style={{ width: `${clamp}%`, backgroundColor: cor }} />
      </div>
      <span className="text-xs font-semibold tabular-nums" style={{ color: cor }}>{pct}%</span>
    </div>
  )
}

function KpiCard({ label, value, alerta, sub }: { label: string; value: string; alerta?: boolean; sub?: string }) {
  return (
    <div
      className="bg-white border border-gray-100 border-l-4 rounded-xl px-4 py-4"
      style={{ borderLeftColor: alerta ? '#EF4444' : '#F2C800' }}
    >
      <p className="text-xs text-gray-500 font-medium mb-1 leading-tight">{label}</p>
      <p className="text-xl font-bold" style={{ color: alerta ? '#EF4444' : '#003087' }}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function TooltipDia({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload as GatilhoDia
  return (
    <div className="bg-white border border-gray-100 shadow-md rounded-xl p-3 text-xs">
      <p className="font-semibold text-gray-700 mb-1">{fmtData(d.data_rota)}</p>
      <p className="text-gray-500">% Dev: <span className="font-bold text-[#003087]">{d.pct_dev.toFixed(2)}%</span></p>
      <p className="text-gray-400 mt-1">{d.pdvs_dev} dev · {d.pdvs_fat.toLocaleString()} fat.</p>
    </div>
  )
}

type Ofensor = { motorista: string; nome: string; dias: number; piorDia: number; dataPior: string }

function TopOfensores({ dados, gatilhoNum }: { dados: GatilhoMotorista[]; gatilhoNum: number }) {
  const top: Ofensor[] = useMemo(() => {
    const mapa = new Map<string, Ofensor>()
    for (const m of dados) {
      if (m.devs_dia <= gatilhoNum) continue
      const ex = mapa.get(m.motorista)
      if (!ex) {
        mapa.set(m.motorista, { motorista: m.motorista, nome: m.nome_motorista, dias: 1, piorDia: m.devs_dia, dataPior: m.data_rota })
      } else {
        mapa.set(m.motorista, {
          ...ex,
          dias:     ex.dias + 1,
          piorDia:  m.devs_dia > ex.piorDia ? m.devs_dia  : ex.piorDia,
          dataPior: m.devs_dia > ex.piorDia ? m.data_rota : ex.dataPior,
        })
      }
    }
    return [...mapa.values()].sort((a, b) => b.dias - a.dias || b.piorDia - a.piorDia).slice(0, 5)
  }, [dados, gatilhoNum])

  if (top.length === 0) return null
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4">
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
        Top ofensores — piores para causa raiz
      </p>
      <ol className="space-y-2">
        {top.map((o, i) => (
          <li key={o.motorista} className="flex items-center gap-3">
            <span
              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
              style={{ backgroundColor: i === 0 ? '#DC2626' : i === 1 ? '#D97706' : '#6B7280' }}
            >
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-800 truncate">{o.nome}</p>
              <p className="text-xs text-gray-400">{o.motorista}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-bold text-red-600">{o.dias}x estouro</p>
              <p className="text-xs text-gray-400">Pior: {o.piorDia} dev em {fmtData(o.dataPior)}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

// ── TabMotoristas ─────────────────────────────────────────────────────────────
interface TabMotoristaProps {
  dados:       GatilhoMotorista[]
  filtrados:   GatilhoMotorista[]
  quase:       string[]
  gatilhoNum:  number
  mediaN:      number
  desvioN:     number
  sigma:       number
  periodoRef:  string
  busca:       string
  soEstouro:   boolean
  onBusca:     (v: string) => void
  onSoEstouro: (v: boolean) => void
}

function TabMotoristas({
  dados, filtrados, quase,
  gatilhoNum, mediaN, desvioN,
  sigma, periodoRef, busca, soEstouro,
  onBusca, onSoEstouro,
}: TabMotoristaProps) {
  const estouros       = dados.filter(m => m.devs_dia > gatilhoNum)
  const motoristasUniq = new Set(estouros.map(m => m.motorista)).size
  const diasUniq       = new Set(estouros.map(m => m.data_rota)).size

  return (
    <div className="space-y-4">
      {/* Stats banner numérico */}
      <div className="bg-[#FFF8DC] border border-[#F2C800]/40 rounded-xl px-5 py-3 flex flex-wrap gap-x-8 gap-y-1.5 text-sm">
        <span className="text-gray-600">
          μ: <strong className="text-[#D4A800]">{mediaN.toFixed(1)} dev/dia</strong>
        </span>
        <span className="text-gray-600">
          σ: <strong className="text-[#D4A800]">{desvioN.toFixed(1)} dev</strong>
        </span>
        <span className="text-gray-600">
          Gatilho ({sigma}σ): <strong className="text-red-500">{Number.isInteger(gatilhoNum) ? gatilhoNum : gatilhoNum.toFixed(2)} dev/dia</strong>
        </span>
        <span className="text-gray-400 text-xs self-center">Referência: {periodoRef}</span>
      </div>

      {/* Resumo de estouro */}
      {estouros.length > 0 ? (
        <div className="bg-red-50 border border-red-100 rounded-xl p-4 flex flex-wrap gap-6">
          <div>
            <p className="text-xs text-red-400 font-medium uppercase tracking-wide mb-0.5">Eventos de estouro</p>
            <p className="text-2xl font-bold text-red-600">{estouros.length}</p>
          </div>
          <div>
            <p className="text-xs text-red-400 font-medium uppercase tracking-wide mb-0.5">Motoristas</p>
            <p className="text-2xl font-bold text-red-600">{motoristasUniq}</p>
          </div>
          <div>
            <p className="text-xs text-red-400 font-medium uppercase tracking-wide mb-0.5">Dias com ocorrência</p>
            <p className="text-2xl font-bold text-red-600">{diasUniq}</p>
          </div>
        </div>
      ) : dados.length > 0 ? (
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-5 py-3 text-sm text-emerald-700 font-medium">
          Nenhum motorista excedeu o gatilho no período.
        </div>
      ) : null}

      {/* Top ofensores para causa raiz */}
      <TopOfensores dados={dados} gatilhoNum={gatilhoNum} />

      {/* Alerta precoce */}
      {quase.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <p className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-2">
            Alerta precoce — dias entre 70–99% do gatilho
          </p>
          <div className="flex flex-wrap gap-2">
            {quase.map(nome => (
              <span key={nome} className="bg-amber-100 text-amber-800 text-xs font-semibold px-2.5 py-1 rounded-full">
                {nome}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Controles */}
      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="text"
          value={busca}
          onChange={e => onBusca(e.target.value)}
          placeholder="Buscar motorista..."
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#F2C800] focus:outline-none w-56"
        />
        <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
          <button
            onClick={() => onSoEstouro(true)}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              soEstouro ? 'bg-red-500 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Só estouro
          </button>
          <button
            onClick={() => onSoEstouro(false)}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              !soEstouro ? 'bg-[#003087] text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Todos c/ dev
          </button>
        </div>
      </div>

      {/* Tabela de eventos diários */}
      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
        <div className="overflow-auto max-h-[32rem]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="bg-[#003087] text-white text-xs font-medium">
                <th className="text-left   py-2.5 px-4">Data</th>
                <th className="text-left   py-2.5 px-4">Motorista</th>
                <th className="text-right  py-2.5 px-4">Fat. Dia</th>
                <th className="text-right  py-2.5 px-4">Dev. Dia</th>
                <th className="text-right  py-2.5 px-4">Δ Gatilho</th>
                <th className="text-left   py-2.5 px-4">Uso do Gatilho</th>
                <th className="text-center py-2.5 px-4">Zona ABC</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((m, i) => {
                const zona  = getZona(m.devs_dia, mediaN, desvioN, sigma)
                const c     = ZONA[zona]
                const delta = m.devs_dia - gatilhoNum
                return (
                  <tr
                    key={`${m.data_rota}-${m.motorista}-${i}`}
                    className="border-b border-gray-50"
                    style={{ backgroundColor: zona !== 'normal' ? c.rowBg : undefined }}
                  >
                    <td className="py-2.5 px-4 font-semibold text-[#003087] whitespace-nowrap">
                      {fmtData(m.data_rota)}
                    </td>
                    <td className="py-2.5 px-4">
                      <p
                        className="font-medium text-sm"
                        style={{ color: zona === 'critica' ? '#DC2626' : '#111111' }}
                      >
                        {m.nome_motorista}
                      </p>
                      <p className="text-gray-400 text-xs">{m.motorista}</p>
                    </td>
                    <td className="py-2.5 px-4 text-right text-gray-400 text-xs">{m.fat_dia.toLocaleString()}</td>
                    <td
                      className="py-2.5 px-4 text-right font-bold"
                      style={{ color: zona === 'critica' ? '#DC2626' : '#003087' }}
                    >
                      {m.devs_dia}
                    </td>
                    <td
                      className={`py-2.5 px-4 text-right text-xs font-semibold ${delta > 0 ? 'text-red-500' : 'text-emerald-600'}`}
                    >
                      {delta > 0 ? '+' : ''}{delta}
                    </td>
                    <td className="py-2.5 px-4"><UsoBarra valor={m.devs_dia} gatilho={gatilhoNum} /></td>
                    <td className="py-2.5 px-4 text-center"><ZonaBadge zona={zona} /></td>
                  </tr>
                )
              })}
              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-400 text-sm">
                    {soEstouro
                      ? 'Nenhum estouro de gatilho no período.'
                      : dados.length === 0
                        ? 'Selecione um mês para ver os dados.'
                        : 'Nenhum motorista encontrado.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {filtrados.length > 0 && (
          <div className="px-4 py-2 border-t border-gray-50 text-xs text-gray-400">
            {filtrados.length} {soEstouro ? 'evento(s) de estouro' : 'dia(s) com devolução'}
          </div>
        )}
      </div>
    </div>
  )
}

export function GatilhoClient({ geral, total, fechado, initialTab }: Props) {
  const router       = useRouter()
  const pathname     = usePathname()
  const searchParams = useSearchParams()
  const [tab,       setTab]       = useState(initialTab)
  const [sigma,     setSigma]     = useState(2.0)
  const [busca,     setBusca]     = useState('')
  const [soEstouro, setSoEstouro] = useState(true)

  function trocarTab(key: string) {
    setTab(key)
    setBusca('')
    const p = new URLSearchParams(searchParams.toString())
    p.set('tab', key)
    router.replace(`${pathname}?${p.toString()}`)
  }

  // Gatilho % geral (para aba Geral e KPIs de frota)
  const mediaGeral   = geral[0]?.media_prev  ?? 0
  const desvioGeral  = geral[0]?.desvio_prev ?? 0
  const gatilhoGeral = mediaGeral + sigma * desvioGeral

  // Gatilho numérico independente para Dev. Total
  const mediaTotal   = total[0]?.media_prev   ?? 0
  const desvioTotal  = total[0]?.desvio_prev  ?? 0
  const gatilhoTotal = mediaTotal + sigma * desvioTotal

  // Gatilho numérico independente para PDV Fechado — arredondado para cima
  const mediaFechado   = fechado[0]?.media_prev   ?? 0
  const desvioFechado  = fechado[0]?.desvio_prev  ?? 0
  const gatilhoFechado = Math.ceil(mediaFechado + sigma * desvioFechado)

  const periodoRef = geral[0]?.periodo_ref ?? total[0]?.periodo_ref ?? '—'

  // KPIs
  const diasCrit       = geral.filter(d => d.pct_dev > gatilhoGeral).length
  const totalEventos   = total.filter(m => m.devs_dia > gatilhoTotal).length
  const fechadoEventos = fechado.filter(m => m.devs_dia > gatilhoFechado).length

  // Filtros para aba Dev. Total
  const totalFiltrado = useMemo(() => {
    const q = busca.toLowerCase()
    const r = busca
      ? total.filter(m => m.nome_motorista.toLowerCase().includes(q) || m.motorista.includes(q))
      : total
    return soEstouro ? r.filter(m => m.devs_dia > gatilhoTotal) : r
  }, [total, busca, soEstouro, gatilhoTotal])

  // Filtros para aba PDV Fechado
  const fechadoFiltrado = useMemo(() => {
    const q = busca.toLowerCase()
    const r = busca
      ? fechado.filter(m => m.nome_motorista.toLowerCase().includes(q) || m.motorista.includes(q))
      : fechado
    return soEstouro ? r.filter(m => m.devs_dia > gatilhoFechado) : r
  }, [fechado, busca, soEstouro, gatilhoFechado])

  // Alerta precoce — motoristas em 70–99% do gatilho numérico
  const totalQuase = useMemo(() =>
    [...new Set(
      total
        .filter(m => {
          const p = gatilhoTotal > 0 ? (m.devs_dia / gatilhoTotal) * 100 : 0
          return p >= 70 && p < 100
        })
        .map(m => m.nome_motorista)
    )].slice(0, 6),
  [total, gatilhoTotal])

  const fechadoQuase = useMemo(() =>
    [...new Set(
      fechado
        .filter(m => {
          const p = gatilhoFechado > 0 ? (m.devs_dia / gatilhoFechado) * 100 : 0
          return p >= 70 && p < 100
        })
        .map(m => m.nome_motorista)
    )].slice(0, 6),
  [fechado, gatilhoFechado])

  // ── Tab Geral ─────────────────────────────────────────────────────────────
  const geralMax = Math.max(...geral.map(d => Math.max(d.pct_dev, gatilhoGeral)), 1)

  const tabGeral = (
    <div className="space-y-4">
      {geral[0] && (
        <div className="bg-[#FFF8DC] border border-[#F2C800]/40 rounded-xl px-5 py-3 flex flex-wrap gap-x-8 gap-y-1.5 text-sm">
          <span className="text-gray-600">μ: <strong className="text-[#D4A800]">{mediaGeral.toFixed(2)}%</strong></span>
          <span className="text-gray-600">σ: <strong className="text-[#D4A800]">{desvioGeral.toFixed(2)}%</strong></span>
          <span className="text-gray-600">
            Gatilho ({sigma}σ): <strong className="text-red-500">{gatilhoGeral.toFixed(2)}%</strong>
          </span>
          <span className="text-gray-400 text-xs self-center">Referência: {periodoRef}</span>
        </div>
      )}

      {geral.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <p className="text-xs font-medium text-gray-400 mb-3">Evolução diária % Dev vs Gatilho</p>
          <ResponsiveContainer width="100%" height={160}>
            <ComposedChart data={geral} margin={{ left: 0, right: 24, top: 4 }}>
              <CartesianGrid strokeDasharray="4 4" stroke="#F3F4F6" />
              <XAxis dataKey="data_rota" tickFormatter={fmtData} tick={{ fontSize: 10, fill: '#6B7280' }} />
              <YAxis
                tickFormatter={v => `${v}%`}
                tick={{ fontSize: 10, fill: '#6B7280' }}
                domain={[0, Math.ceil(geralMax * 1.2)]}
              />
              <Tooltip content={<TooltipDia />} />
              <ReferenceLine
                y={gatilhoGeral}
                stroke="#EF4444"
                strokeDasharray="6 3"
                strokeWidth={1.5}
                label={{ value: `${gatilhoGeral.toFixed(2)}%`, fill: '#EF4444', fontSize: 10, position: 'insideTopRight' }}
              />
              <Bar dataKey="pct_dev" radius={[2, 2, 0, 0]}>
                {geral.map((d, i) => (
                  <Cell
                    key={i}
                    fill={d.pct_dev > gatilhoGeral ? '#EF4444' : '#0057A8'}
                    fillOpacity={d.pct_dev > gatilhoGeral ? 1 : 0.65}
                  />
                ))}
              </Bar>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
        <div className="overflow-auto max-h-[28rem]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="bg-[#003087] text-white text-xs font-medium">
                <th className="text-left   py-2.5 px-4">Data</th>
                <th className="text-right  py-2.5 px-4">Fat.</th>
                <th className="text-right  py-2.5 px-4">Dev.</th>
                <th className="text-right  py-2.5 px-4">% Dev</th>
                <th className="text-left   py-2.5 px-4">Uso do Gatilho</th>
                <th className="text-center py-2.5 px-4">Zona ABC</th>
              </tr>
            </thead>
            <tbody>
              {geral.map(d => {
                const zona = getZona(d.pct_dev, mediaGeral, desvioGeral, sigma)
                const c    = ZONA[zona]
                return (
                  <tr
                    key={d.data_rota}
                    className="border-b border-gray-50"
                    style={{ backgroundColor: zona !== 'normal' ? c.rowBg : undefined }}
                  >
                    <td className="py-2.5 px-4 font-semibold text-[#003087]">{fmtData(d.data_rota)}</td>
                    <td className="py-2.5 px-4 text-right text-gray-400 text-xs">{d.pdvs_fat.toLocaleString()}</td>
                    <td className="py-2.5 px-4 text-right text-gray-600">{d.pdvs_dev}</td>
                    <td
                      className="py-2.5 px-4 text-right font-bold"
                      style={{ color: zona === 'critica' ? '#DC2626' : '#003087' }}
                    >
                      {d.pct_dev.toFixed(2)}%
                    </td>
                    <td className="py-2.5 px-4"><UsoBarra valor={d.pct_dev} gatilho={gatilhoGeral} /></td>
                    <td className="py-2.5 px-4 text-center"><ZonaBadge zona={zona} /></td>
                  </tr>
                )
              })}
              {geral.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-400 text-sm">
                    Selecione um mês para calcular o gatilho.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )

  return (
    <div className="space-y-5">
      {/* Sigma selector */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 font-medium">Sensibilidade do gatilho:</span>
          <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
            {SIGMAS.map(s => (
              <button
                key={s.val}
                onClick={() => setSigma(s.val)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  sigma === s.val
                    ? 'bg-[#003087] text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
        {periodoRef !== '—' && (
          <span className="text-xs text-gray-400">
            Base: <strong className="text-[#D4A800]">{periodoRef}</strong>
          </span>
        )}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard
          label="Gatilho % Frota"
          value={`${gatilhoGeral.toFixed(2)}%`}
          sub={`μ=${mediaGeral.toFixed(2)}% · σ=${desvioGeral.toFixed(2)}%`}
        />
        <KpiCard
          label="Dias em estouro (frota)"
          value={`${diasCrit} / ${geral.length}`}
          alerta={diasCrit > 0}
        />
        <KpiCard
          label="Gatilho Dev. Total"
          value={`${gatilhoTotal.toFixed(2)} dev/dia`}
          sub={`${totalEventos} evento(s) de estouro`}
          alerta={totalEventos > 0}
        />
        <KpiCard
          label="Gatilho PDV Fechado"
          value={`${gatilhoFechado} dev/dia`}
          sub={`${fechadoEventos} evento(s) de estouro`}
          alerta={fechadoEventos > 0}
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => trocarTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t.key
                ? 'bg-white text-[#003087] shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'geral' && tabGeral}
      {tab === 'total' && (
        <TabMotoristas
          dados={total}         filtrados={totalFiltrado}    quase={totalQuase}
          gatilhoNum={gatilhoTotal} mediaN={mediaTotal}      desvioN={desvioTotal}
          sigma={sigma}         periodoRef={periodoRef}
          busca={busca}         soEstouro={soEstouro}
          onBusca={setBusca}    onSoEstouro={setSoEstouro}
        />
      )}
      {tab === 'fechado' && (
        <TabMotoristas
          dados={fechado}         filtrados={fechadoFiltrado}  quase={fechadoQuase}
          gatilhoNum={gatilhoFechado} mediaN={mediaFechado}    desvioN={desvioFechado}
          sigma={sigma}           periodoRef={periodoRef}
          busca={busca}           soEstouro={soEstouro}
          onBusca={setBusca}      onSoEstouro={setSoEstouro}
        />
      )}
    </div>
  )
}
