'use client'

import { useState, useMemo, Fragment, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { TabelaOfensores } from './TabelaOfensores'
import { ChevronDown, ChevronRight, MapPin } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Cell, ResponsiveContainer,
} from 'recharts'

// ─── tipos ───────────────────────────────────────────────────────────────────

export interface MotoristasComScore {
  motorista: string; nome: string; fat: number; dev: number
  fora_raio: number; total: number; dev_fora: number
  pct_dev: number; pct_fora: number; score: number
}

export interface PdvForaRaio {
  codigo_pdv: string; cliente: string; motivo: string; qtd: number
}

export interface PdvReinc {
  codigo: string; cliente: string; dev: number; fat: number
}

export interface PdvForaItem {
  motorista: string; nome: string; qtd: number
}

export interface ParetoItem {
  motivo: string; qtd: number; pct: number; acum: number
}

export interface RankingForaItem {
  motorista: string; nome: string; dev_fora: number; fat: number; pct_fora: number
}

export interface ReincKpi {
  total: number; comDev: number; reincidentes: number; taxa: number
}

interface Props {
  initialTab:           Tab
  periodoEfetivo:       string | null
  motoristasComScore:   MotoristasComScore[]
  pdvsPorMotorista:     Record<string, PdvForaRaio[]>
  maxPctDev:            number
  maxPctFora:           number
  paretoFora:           ParetoItem[]
  rankingFora:          RankingForaItem[]
  totalFora:            number
  maxQtdFora:           number
  reincidentes:         PdvReinc[]
  reincKpi:             ReincKpi
  pdvForaInfo:          Record<string, PdvForaItem[]>
  motoristasComPdvFora: { cod: string; nome: string }[]
}

// ─── helpers ─────────────────────────────────────────────────────────────────

type Tab      = 'motoristas' | 'pdvs'
type MinDev   = 2 | 3 | 5 | 10

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-100 shadow rounded-lg px-3 py-2 text-xs">
      <p className="text-gray-500 mb-0.5 max-w-[180px] truncate">{label}</p>
      <p className="font-bold text-[#003087]">{payload[0].value} dev.</p>
    </div>
  )
}

function DistTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-100 shadow rounded-lg px-3 py-2 text-xs">
      <p className="text-gray-500 mb-0.5">{label}</p>
      <p className="font-bold text-[#0057A8]">{payload[0].value} PDV{payload[0].value !== 1 ? 's' : ''}</p>
    </div>
  )
}

// ─── componente principal ─────────────────────────────────────────────────────

export function OfensoresClient({
  initialTab, periodoEfetivo,
  motoristasComScore, pdvsPorMotorista, maxPctDev, maxPctFora,
  paretoFora, rankingFora, totalFora, maxQtdFora,
  reincidentes, reincKpi, pdvForaInfo, motoristasComPdvFora,
}: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  const [tab,             setTab]            = useState<Tab>(initialTab)
  const [filtroMotorista, setFiltroMotorista] = useState('todos')
  const [minDev,          setMinDev]          = useState<MinDev>(2)
  const [apenasForaRaio,  setApenasForaRaio]  = useState(false)
  const [expandedPdv,     setExpandedPdv]     = useState<string | null>(null)

  // ── PDV tab: filtros ──────────────────────────────────────────────────────
  const pdvsFiltrados = useMemo(() => {
    let lista = reincidentes.filter(p => p.dev >= minDev)
    if (apenasForaRaio) lista = lista.filter(p => !!pdvForaInfo[p.codigo]?.length)
    if (filtroMotorista !== 'todos')
      lista = lista.filter(p =>
        pdvForaInfo[p.codigo]?.some(item => item.motorista === filtroMotorista)
      )
    return lista
  }, [reincidentes, minDev, apenasForaRaio, filtroMotorista, pdvForaInfo])

  // ── Chart 1: top 10 PDVs por devoluções ───────────────────────────────────
  const top10Pdvs = useMemo(() => {
    return pdvsFiltrados.slice(0, 10).map(p => ({
      nome:  p.cliente ? (p.cliente.length > 22 ? p.cliente.slice(0, 20) + '…' : p.cliente) : p.codigo,
      dev:   p.dev,
      fora:  !!(pdvForaInfo[p.codigo]?.length),
    }))
  }, [pdvsFiltrados, pdvForaInfo])

  // ── Chart 2: distribuição em faixas (respeita filtros ativos) ────────────
  const distribuicao = useMemo(() => {
    const buckets: Record<string, number> = { '2': 0, '3': 0, '4–5': 0, '6–9': 0, '10+': 0 }
    for (const p of pdvsFiltrados) {
      if (p.dev === 2)      buckets['2']++
      else if (p.dev === 3) buckets['3']++
      else if (p.dev <= 5)  buckets['4–5']++
      else if (p.dev <= 9)  buckets['6–9']++
      else                  buckets['10+']++
    }
    return Object.entries(buckets).map(([faixa, qtd]) => ({ faixa, qtd }))
  }, [pdvsFiltrados])

  // ── maxPctFora memoizado para o ranking ───────────────────────────────────
  const maxPctForaRanking = useMemo(
    () => Math.max(...rankingFora.map(r => r.pct_fora), 0.01),
    [rankingFora]
  )

  // ── proporção reincidência ────────────────────────────────────────────────
  const pctUnicos = reincKpi.comDev > 0
    ? ((reincKpi.comDev - reincKpi.reincidentes) / reincKpi.comDev) * 100
    : 0

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* Seletor de abas */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {([
          { key: 'motoristas', label: 'Motoristas' },
          { key: 'pdvs',       label: 'PDVs & Reincidência' },
        ] as { key: Tab; label: string }[]).map(t => (
          <button
            key={t.key}
            onClick={() => {
              setTab(t.key)
              // Persiste a aba na URL para sobreviver ao remount por mudança de período
              const p = new URLSearchParams()
              if (periodoEfetivo) p.set('periodo', periodoEfetivo)
              p.set('tab', t.key)
              startTransition(() => router.replace(`/ofensores?${p.toString()}`))
            }}
            className={`px-5 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
              tab === t.key
                ? 'bg-white text-[#003087] shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ════════════════════ ABA MOTORISTAS ════════════════════ */}
      {tab === 'motoristas' && (
        <div className="space-y-5">

          {/* Tabela interativa */}
          <div className="bg-white border border-gray-100 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-[#003087]">Ranking por % Devolução PDV</h2>
              <span className="text-[10px] text-gray-400 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#7c3aed]/30 inline-block" />
                Clique na linha para ver PDVs com devolução fora do raio
              </span>
            </div>
            <TabelaOfensores
              motoristas={motoristasComScore}
              pdvsPorMotorista={pdvsPorMotorista}
              maxPctDev={maxPctDev}
              maxPctFora={maxPctFora}
            />
          </div>

          {/* Pareto + Ranking fora do raio */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

            <div className="bg-white border border-gray-100 rounded-xl p-6">
              <h2 className="font-semibold text-[#003087] mb-1">Pareto — Motivos fora do raio</h2>
              <p className="text-gray-400 text-xs mb-4">{totalFora.toLocaleString('pt-BR')} devoluções fora do raio</p>
              <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                {paretoFora.map(({ motivo, qtd, pct, acum }) => (
                  <div key={motivo}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-gray-700 text-xs truncate flex-1 pr-2">{motivo}</span>
                      <div className="flex items-center gap-2 shrink-0 text-xs">
                        <span className="text-[#111111] font-semibold">{qtd}</span>
                        <span className="text-[#7c3aed] font-bold w-10 text-right">{pct.toFixed(1)}%</span>
                        <span className="text-gray-400 w-14 text-right">∑ {acum.toFixed(1)}%</span>
                      </div>
                    </div>
                    <div className="bg-gray-100 rounded-full h-1.5 overflow-hidden">
                      <div className="h-full rounded-full bg-[#7c3aed]"
                        style={{ width: `${(qtd / maxQtdFora) * 100}%` }} />
                    </div>
                  </div>
                ))}
                {paretoFora.length === 0 && (
                  <p className="text-gray-400 text-xs text-center py-6">Nenhuma devolução fora do raio</p>
                )}
              </div>
            </div>

            <div className="bg-white border border-gray-100 rounded-xl p-6">
              <div className="flex items-center justify-between mb-1">
                <h2 className="font-semibold text-[#003087]">Ranking — % Dev. Fora do Raio</h2>
                <span className="text-[10px] text-gray-400">{rankingFora.length} motoristas</span>
              </div>
              <p className="text-gray-400 text-xs mb-4">devoluções fora do raio ÷ total faturado</p>
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {rankingFora.map((m, i) => (
                  <div key={m.motorista} className="flex items-center gap-3">
                    <span className="text-[#D4A800] text-[10px] font-bold w-4 shrink-0">{i + 1}</span>
                    <span className="text-gray-700 text-xs truncate flex-1">{m.nome}</span>
                    <div className="w-28 bg-gray-100 rounded-full h-2 overflow-hidden shrink-0">
                      <div className="h-full rounded-full bg-[#7c3aed] transition-all"
                        style={{ width: `${(m.pct_fora / maxPctForaRanking) * 100}%` }} />
                    </div>
                    <span className="text-[#7c3aed] text-xs font-bold w-10 text-right shrink-0">
                      {m.pct_fora.toFixed(1)}%
                    </span>
                  </div>
                ))}
                {rankingFora.length === 0 && (
                  <p className="text-gray-400 text-xs text-center py-6">Nenhum motorista</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════ ABA PDVs ════════════════════ */}
      {tab === 'pdvs' && (
        <div className="space-y-5">

          {/* KPIs reincidência */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total PDVs',            value: reincKpi.total.toLocaleString('pt-BR'),           cor: '#003087' },
              { label: 'Com devolução',         value: reincKpi.comDev.toLocaleString('pt-BR'),          cor: '#0057A8' },
              { label: 'Reincidentes (≥2 dev)', value: reincKpi.reincidentes.toLocaleString('pt-BR'),    cor: '#D97706' },
              { label: 'Taxa reincidência',     value: `${reincKpi.taxa.toFixed(1)}%`,                   cor: '#EF4444' },
            ].map(c => (
              <div key={c.label} className="bg-white border border-gray-100 border-l-4 border-l-[#F2C800] rounded-xl px-4 py-4">
                <p className="text-xs text-gray-500 font-medium mb-1">{c.label}</p>
                <p className="text-2xl font-bold" style={{ color: c.cor }}>{c.value}</p>
              </div>
            ))}
          </div>

          {/* Barra proporção */}
          {reincKpi.comDev > 0 && (
            <div className="bg-white border border-gray-100 rounded-xl p-5">
              <p className="text-xs font-semibold text-[#003087] mb-3">Proporção de reincidência nos PDVs com devolução</p>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-gray-500 text-[11px] w-28 shrink-0">Únicos (1 dev.)</span>
                <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                  <div className="h-full rounded-full bg-gray-300" style={{ width: `${pctUnicos}%` }} />
                </div>
                <span className="text-gray-500 text-[11px] w-10 text-right shrink-0">{pctUnicos.toFixed(1)}%</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[#D4A800] text-[11px] font-semibold w-28 shrink-0">Reincidentes</span>
                <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                  <div className="h-full rounded-full bg-[#F2C800]" style={{ width: `${reincKpi.taxa}%` }} />
                </div>
                <span className="text-[#D4A800] text-[11px] font-bold w-10 text-right shrink-0">{reincKpi.taxa.toFixed(1)}%</span>
              </div>
            </div>
          )}

          {/* ── Filtros ── */}
          <div className="bg-white border border-gray-100 rounded-xl p-4">
            <p className="text-xs font-semibold text-[#003087] mb-3">Filtros personalizados</p>
            <div className="flex flex-wrap items-center gap-4">

              {/* Motorista */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-gray-500 shrink-0">Motorista</span>
                <select
                  value={filtroMotorista}
                  onChange={e => { setFiltroMotorista(e.target.value); setExpandedPdv(null) }}
                  className="bg-white border border-gray-200 text-xs rounded-lg px-2.5 py-1.5 focus:border-[#F2C800] focus:outline-none"
                >
                  <option value="todos">Todos</option>
                  {motoristasComPdvFora.map(m => (
                    <option key={m.cod} value={m.cod}>{m.nome}</option>
                  ))}
                </select>
              </div>

              {/* Mínimo devoluções */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-gray-500 shrink-0">Mín. devoluções</span>
                <div className="flex gap-1">
                  {([2, 3, 5, 10] as MinDev[]).map(n => (
                    <button
                      key={n}
                      onClick={() => { setMinDev(n); setExpandedPdv(null) }}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${
                        minDev === n
                          ? 'bg-[#003087] text-white border-[#003087]'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-[#003087]'
                      }`}
                    >
                      {n}+
                    </button>
                  ))}
                </div>
              </div>

              {/* Apenas fora do raio */}
              <label className="flex items-center gap-2 cursor-pointer">
                <div
                  onClick={() => { setApenasForaRaio(v => !v); setExpandedPdv(null) }}
                  className={`w-9 h-5 rounded-full transition-colors relative ${
                    apenasForaRaio ? 'bg-[#7c3aed]' : 'bg-gray-200'
                  }`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                    apenasForaRaio ? 'translate-x-4' : 'translate-x-0.5'
                  }`} />
                </div>
                <span className="text-[11px] text-gray-600">Apenas fora do raio</span>
              </label>

              <span className="ml-auto text-[10px] text-gray-400">
                {pdvsFiltrados.length} PDV{pdvsFiltrados.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {/* ── Gráficos ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

            {/* Chart 1: Top 10 PDVs */}
            <div className="bg-white border border-gray-100 rounded-xl p-5">
              <p className="text-sm font-semibold text-[#003087] mb-0.5">
                Top {Math.min(10, top10Pdvs.length)} PDV{top10Pdvs.length !== 1 ? 's' : ''} mais ofensores
              </p>
              <p className="text-xs text-gray-400 mb-4">por número de devoluções no período</p>
              {top10Pdvs.length > 0 ? (
                <ResponsiveContainer width="100%" height={top10Pdvs.length * 32 + 20}>
                  <BarChart data={top10Pdvs} layout="vertical" margin={{ left: 0, right: 40, top: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="4 4" stroke="#F3F4F6" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="nome" width={140}
                      tick={{ fontSize: 10, fill: '#374151' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: '#F9FAFB' }} />
                    <Bar dataKey="dev" radius={[0, 4, 4, 0]} maxBarSize={16}>
                      {top10Pdvs.map((entry, i) => (
                        <Cell key={i} fill={entry.fora ? '#7c3aed' : '#F2C800'}
                          stroke={entry.fora ? '#6d28d9' : '#D4A800'} strokeWidth={1} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-gray-400 text-xs text-center py-8">Nenhum PDV neste filtro</p>
              )}
              <div className="flex items-center gap-4 mt-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm bg-[#F2C800]" />
                  <span className="text-[10px] text-gray-500">Dentro do raio</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm bg-[#7c3aed]" />
                  <span className="text-[10px] text-gray-500">Fora do raio</span>
                </div>
              </div>
            </div>

            {/* Chart 2: Distribuição por faixas */}
            <div className="bg-white border border-gray-100 rounded-xl p-5">
              <p className="text-sm font-semibold text-[#003087] mb-0.5">Distribuição de reincidência</p>
              <p className="text-xs text-gray-400 mb-4">PDVs agrupados por nº de devoluções</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={distribuicao} margin={{ left: 0, right: 0, top: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="4 4" stroke="#F3F4F6" vertical={false} />
                  <XAxis dataKey="faixa" tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<DistTooltip />} cursor={{ fill: '#F9FAFB' }} />
                  <Bar dataKey="qtd" radius={[4, 4, 0, 0]} maxBarSize={48} fill="#0057A8" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ── Tabela de PDVs ── */}
          <div className="bg-white border border-gray-100 rounded-xl p-5">
            <p className="text-sm font-semibold text-[#003087] mb-4">
              PDVs reincidentes — {pdvsFiltrados.length} resultado{pdvsFiltrados.length !== 1 ? 's' : ''}
            </p>
            <div className="overflow-auto max-h-[36rem]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-[#003087] text-white text-xs font-medium">
                    <th className="text-left py-3 px-2 rounded-tl-lg w-8">#</th>
                    <th className="text-left py-3 px-2 w-24">PDV</th>
                    <th className="text-left py-3 px-2">Cliente</th>
                    <th className="text-right py-3 px-2 w-14">Fat.</th>
                    <th className="text-right py-3 px-2 w-14">Dev.</th>
                    <th className="text-right py-3 px-2 w-16">% Dev.</th>
                    <th className="text-center py-3 px-2 rounded-tr-lg w-24">Fora raio</th>
                  </tr>
                </thead>
                <tbody>
                  {pdvsFiltrados.map((p, i) => {
                    const pct      = p.fat > 0 ? p.dev / p.fat * 100 : 0
                    const foraLst  = pdvForaInfo[p.codigo] ?? []
                    const expanded = expandedPdv === p.codigo

                    return (
                      <Fragment key={p.codigo}>
                        <tr
                          onClick={() => setExpandedPdv(expanded ? null : p.codigo)}
                          className="border-b border-gray-50 hover:bg-[#FFF8DC] cursor-pointer transition-colors"
                        >
                          <td className="py-2.5 px-2 text-[#D4A800] font-bold text-xs">{i + 1}</td>
                          <td className="py-2.5 px-2 text-[#0057A8] font-mono text-xs">{p.codigo}</td>
                          <td className="py-2.5 px-2 text-gray-700 text-xs truncate max-w-0">
                            <div className="flex items-center gap-1.5">
                              {expanded
                                ? <ChevronDown size={12} className="text-gray-400 shrink-0" />
                                : <ChevronRight size={12} className="text-gray-400 shrink-0" />
                              }
                              {p.cliente || '—'}
                            </div>
                          </td>
                          <td className="py-2.5 px-2 text-right text-gray-500 text-xs">{p.fat}</td>
                          <td className="py-2.5 px-2 text-right font-bold text-[#003087] text-xs">{p.dev}</td>
                          <td className="py-2.5 px-2 text-right text-[#D4A800] font-semibold text-xs">{pct.toFixed(1)}%</td>
                          <td className="py-2.5 px-2 text-center">
                            {foraLst.length > 0 ? (
                              <span className="inline-flex items-center gap-1 text-[9px] bg-[#7c3aed]/10 text-[#7c3aed] font-bold px-2 py-0.5 rounded-full">
                                <MapPin size={9} /> {foraLst.length}×
                              </span>
                            ) : (
                              <span className="text-gray-300 text-[10px]">—</span>
                            )}
                          </td>
                        </tr>

                        {/* Linha expandida: motoristas que visitaram fora do raio */}
                        {expanded && (
                          <tr className="bg-[#7c3aed]/5 border-b border-[#7c3aed]/10">
                            <td colSpan={7} className="px-4 py-3">
                              {foraLst.length > 0 ? (
                                <div>
                                  <p className="text-[10px] text-[#7c3aed] font-semibold mb-2 flex items-center gap-1">
                                    <MapPin size={10} /> Motoristas com devolução fora do raio neste PDV
                                  </p>
                                  <div className="flex flex-wrap gap-2">
                                    {[...foraLst].sort((a, b) => b.qtd - a.qtd).map(item => (
                                      <div key={item.motorista}
                                        className="bg-white border border-[#7c3aed]/20 rounded-lg px-3 py-1.5 flex items-center gap-2">
                                        <span className="text-xs text-gray-700">{item.nome}</span>
                                        <span className="text-[9px] bg-[#7c3aed]/10 text-[#7c3aed] font-bold px-1.5 py-0.5 rounded-full">
                                          {item.qtd}×
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : (
                                <p className="text-[11px] text-gray-400">
                                  Nenhuma devolução fora do raio registrada para este PDV no período.
                                </p>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                  {pdvsFiltrados.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-gray-400 text-sm">
                        Nenhum PDV encontrado com os filtros aplicados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
