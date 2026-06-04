'use client'

import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, LabelList,
} from 'recharts'

interface DadoDiario    { data: string; dev: number; fat: number; pct: number; vol_fat: number; vol_dev: number; pct_hl: number }
interface DadoMotivo    { motivo: string; qtd: number; pct: number }
interface DadoMotorista { nome: string; dev: number; fat: number; pct: number; vol_fat: number; vol_dev: number; pct_hl: number }
interface DadoCls       { cls: string; dev: number; pct: number; cor: string }

interface Props {
  diarios:        DadoDiario[]
  motivos:        DadoMotivo[]
  motoristas:     DadoMotorista[]
  classificacoes: DadoCls[]
  totalFaturados: number
  isMonthly:      boolean
}

const MESES_ABREV = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

function formatarEixoX(v: string, isMonthly: boolean): string {
  if (isMonthly) {
    // v = 'YYYY-MM'
    const m = parseInt(v.split('-')[1]) - 1
    return MESES_ABREV[m] ?? v
  }
  // v = 'YYYY-MM-DD'
  return new Date(v + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

const AMARELO = '#F2C800'
const AZUL    = '#003087'

function TooltipDiario({ active, payload, tipo, isMonthly }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload as DadoDiario
  const titulo = isMonthly
    ? (() => { const m = parseInt(d.data.split('-')[1]) - 1; return MESES_ABREV[m] ?? d.data })()
    : new Date(d.data + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  return (
    <div className="bg-white border border-gray-100 rounded-lg px-3 py-2 text-xs shadow-sm space-y-0.5">
      <p className="text-gray-500 mb-1">{titulo}</p>
      {tipo === 'pdv' ? (
        <>
          <p className="text-[#003087]">% Dev PDV: <strong>{d.pct.toFixed(2)}%</strong></p>
          <p className="text-gray-500">Devolvidos: <strong>{d.dev.toLocaleString('pt-BR')}</strong></p>
          <p className="text-gray-400">Faturados: {d.fat.toLocaleString('pt-BR')}</p>
        </>
      ) : (
        <>
          <p className="text-[#003087]">% Dev HL: <strong>{d.pct_hl.toFixed(2)}%</strong></p>
          <p className="text-gray-500">Dev HL: <strong>{d.vol_dev.toFixed(2)}</strong></p>
          <p className="text-gray-400">Fat HL: {d.vol_fat.toFixed(2)}</p>
        </>
      )}
    </div>
  )
}

function Card({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5">
      <p className="text-sm font-medium text-gray-500 mb-4">{titulo}</p>
      {children}
    </div>
  )
}

function Empty() {
  return <p className="text-gray-400 text-xs text-center py-6">Sem dados</p>
}

export function GraficosTabs({ diarios, motivos, motoristas, classificacoes, totalFaturados, isMonthly }: Props) {
  // pct individual → base faturados (igual aos KPIs do dashboard)
  // acumPct → base total de devoluções (pareto clássico de impacto do motivo)
  const baseFat  = totalFaturados > 0 ? totalFaturados : 1
  const totalDev = motivos.reduce((s, m) => s + m.qtd, 0)
  const baseDev  = totalDev > 0 ? totalDev : 1
  const maxQtd   = motivos[0]?.qtd ?? 1
  let acumulado  = 0
  const pareto   = motivos.map(m => {
    acumulado += m.qtd
    return {
      ...m,
      pct:     m.qtd / baseFat * 100,
      acumPct: acumulado / baseDev * 100,
    }
  })

  return (
    <div className="space-y-4">

      {/* PDV + HL por dia — 2 colunas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card titulo={isMonthly ? '% Devolução PDV por mês' : '% Devolução PDV por dia'}>
          {diarios.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={diarios} margin={{ top: 16, right: 8, left: -14, bottom: 0 }}>
                <CartesianGrid strokeDasharray="4 4" stroke="#F3F4F6" vertical={false} />
                <XAxis
                  dataKey="data"
                  tick={{ fill: '#6B7280', fontSize: isMonthly ? 10 : 9 }}
                  tickFormatter={v => formatarEixoX(v, isMonthly)}
                />
                <YAxis tick={{ fill: '#6B7280', fontSize: 10 }} tickFormatter={v => `${v}%`} />
                <Tooltip content={<TooltipDiario tipo="pdv" isMonthly={isMonthly} />} />
                <Bar dataKey="pct" fill={AMARELO} radius={[3, 3, 0, 0]}>
                  <LabelList
                    dataKey="dev"
                    position="inside"
                    formatter={(v: number) => v > 0 ? v.toLocaleString('pt-BR') : ''}
                    style={{ fill: '#003087', fontSize: 8, fontWeight: 600 }}
                  />
                  <LabelList
                    dataKey="pct"
                    position="top"
                    formatter={(v: number) => v > 0 ? `${v.toFixed(1)}%` : ''}
                    style={{ fill: '#6B7280', fontSize: 9 }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card titulo={isMonthly ? '% Devolução HL por mês' : '% Devolução HL por dia'}>
          {diarios.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={diarios} margin={{ top: 16, right: 8, left: -14, bottom: 0 }}>
                <CartesianGrid strokeDasharray="4 4" stroke="#F3F4F6" vertical={false} />
                <XAxis
                  dataKey="data"
                  tick={{ fill: '#6B7280', fontSize: isMonthly ? 10 : 9 }}
                  tickFormatter={v => formatarEixoX(v, isMonthly)}
                />
                <YAxis tick={{ fill: '#6B7280', fontSize: 10 }} tickFormatter={v => `${v}%`} />
                <Tooltip content={<TooltipDiario tipo="hl" isMonthly={isMonthly} />} />
                <Bar dataKey="pct_hl" fill={AZUL} radius={[3, 3, 0, 0]}>
                  <LabelList
                    dataKey="vol_dev"
                    position="inside"
                    formatter={(v: number) => v > 0 ? v.toFixed(1) : ''}
                    style={{ fill: '#F2C800', fontSize: 8, fontWeight: 600 }}
                  />
                  <LabelList
                    dataKey="pct_hl"
                    position="top"
                    formatter={(v: number) => v > 0 ? `${v.toFixed(1)}%` : ''}
                    style={{ fill: '#6B7280', fontSize: 9 }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* Pareto de Motivos + Classificação — 2 colunas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Pareto */}
        <Card titulo="Pareto de motivos">
          {pareto.length === 0 ? <Empty /> : (
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {pareto.map(({ motivo, qtd, pct, acumPct }) => (
                <div key={motivo}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-gray-700 text-xs truncate flex-1 pr-2">{motivo}</span>
                    <div className="flex items-center gap-2 shrink-0 text-xs">
                      <span className="text-[#111111] font-semibold">{qtd.toLocaleString('pt-BR')}</span>
                      <span className="text-[#D4A800] font-bold w-10 text-right">{pct.toFixed(1)}%</span>
                      <span className="text-gray-400 w-16 text-right">∑ {acumPct.toFixed(1)}%</span>
                    </div>
                  </div>
                  <div className="bg-gray-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#F2C800]"
                      style={{ width: `${(qtd / maxQtd) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Por Classificação */}
        <Card titulo="Por classificação">
          {classificacoes.length === 0 ? <Empty /> : (
            <div className="space-y-4 pt-1">
              {classificacoes.map(c => (
                <div key={c.cls}>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium" style={{ color: c.cor }}>{c.cls}</span>
                    <span className="text-sm font-bold" style={{ color: c.cor }}>{c.pct.toFixed(1)}%</span>
                  </div>
                  <div className="bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${c.pct}%`, backgroundColor: c.cor }} />
                  </div>
                  <p className="text-gray-400 text-[10px] mt-0.5">{c.dev.toLocaleString('pt-BR')} devoluções</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Por Motorista — tabela com duas barras inline + scroll */}
      <Card titulo="Devolução por motorista">
        {motoristas.length === 0 ? <Empty /> : (() => {
          const maxPdv = Math.max(...motoristas.map(m => m.pct), 0.01)
          const maxHl  = Math.max(...motoristas.map(m => m.pct_hl), 0.01)
          return (
            <div className="overflow-y-auto max-h-72">
              {/* Header */}
              <div className="grid gap-2 pb-2 mb-1 border-b border-gray-100 text-[10px] font-medium text-gray-400 uppercase tracking-wide"
                style={{ gridTemplateColumns: '1fr 120px 120px 48px 52px' }}>
                <span>Motorista</span>
                <span className="text-center">PDV%</span>
                <span className="text-center">HL%</span>
                <span className="text-right">Dev</span>
                <span className="text-right">Vol HL</span>
              </div>
              {/* Linhas */}
              {motoristas.map((m, i) => (
                <div key={`${i}-${m.nome}`}
                  className="grid gap-2 py-2 border-b border-gray-50 hover:bg-[#FFF8DC] items-center"
                  style={{ gridTemplateColumns: '1fr 120px 120px 48px 52px' }}>
                  {/* Nome */}
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[10px] text-gray-400 w-4 shrink-0 text-right">{i + 1}</span>
                    <span className="text-xs text-gray-700 truncate">{m.nome}</span>
                  </div>
                  {/* PDV % */}
                  <div className="flex items-center gap-1.5">
                    <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div className="h-full rounded-full bg-[#F2C800]"
                        style={{ width: `${(m.pct / maxPdv) * 100}%` }} />
                    </div>
                    <span className="text-[#D4A800] text-[10px] font-bold w-8 text-right shrink-0">{m.pct.toFixed(1)}%</span>
                  </div>
                  {/* HL % */}
                  <div className="flex items-center gap-1.5">
                    <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div className="h-full rounded-full bg-[#003087]"
                        style={{ width: `${(m.pct_hl / maxHl) * 100}%` }} />
                    </div>
                    <span className="text-[#003087] text-[10px] font-bold w-8 text-right shrink-0">{m.pct_hl.toFixed(1)}%</span>
                  </div>
                  {/* Dev nominal */}
                  <span className="text-[10px] text-gray-500 text-right">{m.dev}</span>
                  {/* Vol HL */}
                  <span className="text-[10px] text-gray-500 text-right">{m.vol_dev.toFixed(1)}</span>
                </div>
              ))}
            </div>
          )
        })()}
      </Card>

    </div>
  )
}
