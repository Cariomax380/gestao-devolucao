'use client'

import { useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, Legend,
} from 'recharts'
import type { Celula, CelulaClass, CelulaHorario } from './page'

/* ── constantes ──────────────────────────────────────── */
const DIAS     = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom']
const DIAS_ISO = [1, 2, 3, 4, 5, 6, 7]

// Faixas em ordem cronológica (Sem horario no fim)
const FAIXAS_ORDEM = ['Ate 9h', '9h - 12h', '12h - 15h', '15h - 18h', '18h ou mais', 'Sem horario']

const CLASS_COR: Record<string, string> = {
  'Mercado':           '#F2C800',
  'Logistico':         '#0057A8',
  'Vendas':            '#f472b6',
  'Sem classificacao': '#9CA3AF',
}
function corClass(c: string) {
  const norm = c.normalize('NFD').replace(/[̀-ͯ]/g, '')
  return CLASS_COR[norm] ?? CLASS_COR[c] ?? '#9CA3AF'
}

/* ── sistema de cores: interpolação RGB real ─────────────
   branco-âmbar → âmbar → laranja → vermelho              */
type RGB = [number, number, number]
const HEAT_STOPS: RGB[] = [
  [254, 243, 199], // amber-100
  [252, 211,  77], // amber-300
  [249, 115,  22], // orange-500
  [239,  68,  68], // red-400
]
function lerp(a: number, b: number, t: number) { return Math.round(a + (b - a) * t) }

function heatColor(ratio: number): string {
  if (ratio <= 0) return '#F9FAFB'
  const n = HEAT_STOPS.length - 1
  const i = Math.min(Math.floor(ratio * n), n - 1)
  const t = ratio * n - i
  const [r1, g1, b1] = HEAT_STOPS[i]
  const [r2, g2, b2] = HEAT_STOPS[i + 1] ?? HEAT_STOPS[n]
  return `rgb(${lerp(r1,r2,t)},${lerp(g1,g2,t)},${lerp(b1,b2,t)})`
}
function classHeatColor(ratio: number, hex: string): string {
  if (ratio <= 0) return '#F9FAFB'
  const r2 = parseInt(hex.slice(1,3),16), g2 = parseInt(hex.slice(3,5),16), b2 = parseInt(hex.slice(5,7),16)
  return `rgb(${lerp(255,r2,ratio)},${lerp(251,g2,ratio)},${lerp(235,b2,ratio)})`
}
function textColor(ratio: number): string { return ratio >= 0.62 ? '#FFFFFF' : '#003087' }

/* ── helpers lookup ──────────────────────────────────── */
function getQtd (d: Celula[],      motivo: string, dia: number) { return d.find(x=>x.motivo===motivo&&x.dia===dia)?.qtd??0 }
function getQtdC(d: CelulaClass[], cls: string,    dia: number) { return d.find(x=>x.classificacao===cls&&x.dia===dia)?.qtd??0 }
function getQtdH(d: CelulaHorario[],faixa:string,  dia: number) { return d.find(x=>x.faixa===faixa&&x.dia===dia)?.qtd??0 }

/* ── Legenda gradiente ───────────────────────────────── */
function LegendaGradiente() {
  return (
    <div className="flex items-center gap-2 mt-4 flex-wrap">
      <p className="text-gray-400 text-[10px]">Intensidade:</p>
      <p className="text-gray-300 text-[10px]">baixo</p>
      {[0.05,0.2,0.4,0.65,0.85,1].map(v=>(
        <div key={v} className="w-6 h-4 rounded border border-white/20" style={{backgroundColor:heatColor(v)}}/>
      ))}
      <p className="text-gray-400 text-[10px]">alto</p>
    </div>
  )
}

type Escala = 'motivo'|'log'|'global'
type Modo   = 'qtd'|'pct'
type Tab    = 'motivo'|'classificacao'

interface Props { dados:Celula[]; dadosClass:CelulaClass[]; dadosHorario:CelulaHorario[] }

/* ════════════════════════════════════════════════════════
   BLOCO: Heatmap genérico reutilizável
   linhas = labels[], colunas = dias, cell = getVal fn
   ════════════════════════════════════════════════════════ */
interface HeatmapProps {
  linhas:     string[]
  labelWidth: number
  getVal:     (linha: string, dia: number) => number
  getMax:     (linha: string) => number           // para escala por linha
  maxGlobal:  number
  escala:     Escala
  getTotalLinha: (linha: string) => number
  getTotalColuna:(dia: number) => number
  totalGeral: number
  renderLabel:(linha: string) => React.ReactNode
  exibir?:   (qtd: number, linha: string) => string
}

function HeatGrid({
  linhas, labelWidth, getVal, getMax, maxGlobal, escala,
  getTotalLinha, getTotalColuna, totalGeral, renderLabel, exibir,
}: HeatmapProps) {
  const totaisColuna = DIAS_ISO.map(d => getTotalColuna(d))
  const maxColuna    = Math.max(...totaisColuna, 1)

  function ratio(qtd: number, linha: string) {
    if (qtd === 0) return 0
    if (escala === 'global') return qtd / maxGlobal
    if (escala === 'log')    return Math.log1p(qtd) / Math.log1p(maxGlobal)
    return qtd / getMax(linha)
  }

  const cols = `${labelWidth}px repeat(7, 1fr) 64px`

  return (
    <div className="min-w-[560px]">
      {/* Cabeçalho */}
      <div className="grid mb-1" style={{gridTemplateColumns:cols}}>
        <div/>
        {DIAS.map(d=>(
          <p key={d} className="text-center text-gray-500 text-[10px] font-medium uppercase tracking-wider pb-1">{d}</p>
        ))}
        <p className="text-center text-gray-500 text-[10px] font-medium uppercase tracking-wider pb-1">Total</p>
      </div>

      {/* Linhas */}
      {linhas.map(linha=>(
        <div key={linha} className="grid items-center gap-1 mb-1" style={{gridTemplateColumns:cols}}>
          {renderLabel(linha)}
          {DIAS_ISO.map(dia=>{
            const qtd = getVal(linha, dia)
            const r   = ratio(qtd, linha)
            const txt = exibir ? exibir(qtd, linha) : (qtd > 0 ? qtd.toLocaleString('pt-BR') : '')
            return (
              <div key={dia}
                title={`${linha} — ${DIAS[dia-1]}: ${qtd} dev.`}
                className="h-8 rounded-lg flex items-center justify-center border border-white/20"
                style={{backgroundColor:heatColor(r)}}
              >
                {qtd > 0 && <span className="text-[10px] font-bold" style={{color:textColor(r)}}>{txt}</span>}
              </div>
            )
          })}
          <div className="h-8 rounded-lg flex items-center justify-center bg-gray-50 border border-gray-200">
            <span className="text-[10px] font-bold text-gray-600">{getTotalLinha(linha).toLocaleString('pt-BR')}</span>
          </div>
        </div>
      ))}

      {/* Linha totais */}
      <div className="grid items-center gap-1 mt-2 pt-2 border-t border-gray-100" style={{gridTemplateColumns:cols}}>
        <p className="text-xs font-semibold text-gray-500">Total</p>
        {totaisColuna.map((qtd,i)=>{
          const r = qtd/maxColuna
          return (
            <div key={i} className="h-8 rounded-lg flex items-center justify-center border border-white/20"
              style={{backgroundColor:heatColor(r)}}>
              <span className="text-[10px] font-bold" style={{color:textColor(r)}}>{qtd.toLocaleString('pt-BR')}</span>
            </div>
          )
        })}
        <div className="h-8 rounded-lg flex items-center justify-center bg-[#003087]">
          <span className="text-[10px] font-bold text-white">{totalGeral.toLocaleString('pt-BR')}</span>
        </div>
      </div>

      <LegendaGradiente/>
    </div>
  )
}

/* ════════════════════════════════════════════════════════
   ABA: Motivo × Dia  +  Faixa Horária × Dia
   ════════════════════════════════════════════════════════ */
function TabMotivo({ dados, dadosHorario }: { dados: Celula[]; dadosHorario: CelulaHorario[] }) {
  const [escala, setEscala] = useState<Escala>('motivo')
  const [modo,   setModo  ] = useState<Modo>('qtd')

  /* ── Motivo × Dia ── */
  const motivos = [...new Set(dados.map(d=>d.motivo))]
  const totaisLinha = Object.fromEntries(
    motivos.map(m=>[m, DIAS_ISO.reduce((s,d)=>s+getQtd(dados,m,d), 0)])
  )
  const motivosOrdenados = [...motivos].sort((a,b)=>totaisLinha[b]-totaisLinha[a])
  const totalGeralMotivo = dados.reduce((s,d)=>s+d.qtd, 0)
  const maxGlobalMotivo  = Math.max(...dados.map(d=>d.qtd), 1)

  /* ── Faixa Horária × Dia ── */
  const faixasPresentes = [...new Set(dadosHorario.map(d=>d.faixa))]
  const faixas          = FAIXAS_ORDEM.filter(f=>faixasPresentes.includes(f))
  const totalGeralHora  = dadosHorario.reduce((s,d)=>s+d.qtd, 0)
  const maxGlobalHora   = Math.max(...dadosHorario.map(d=>d.qtd), 1)

  const totaisHoraLinha   = Object.fromEntries(faixas.map(f=>[f, DIAS_ISO.reduce((s,d)=>s+getQtdH(dadosHorario,f,d),0)]))
  const totaisHoraColuna  = DIAS_ISO.map(d=>dadosHorario.filter(x=>x.dia===d).reduce((s,x)=>s+x.qtd,0))

  // bar chart faixas
  const chartFaixas = faixas.map(f=>({
    faixa: f,
    qtd:   totaisHoraLinha[f],
    pct:   totalGeralHora>0 ? Math.round((totaisHoraLinha[f]/totalGeralHora)*100) : 0,
  }))
  const maxFaixaQtd = Math.max(...chartFaixas.map(d=>d.qtd), 1)

  function exibirMotivo(qtd: number, motivo: string) {
    if (qtd === 0) return ''
    if (modo === 'pct') {
      const t = totaisLinha[motivo]
      return t > 0 ? `${Math.round((qtd/t)*100)}%` : ''
    }
    return qtd.toLocaleString('pt-BR')
  }

  return (
    <div className="space-y-4">

      {/* ── 1. Motivo × Dia ── */}
      <div className="bg-white border border-gray-100 rounded-xl p-5 overflow-auto">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <p className="text-sm font-medium text-gray-700">Motivo × Dia da semana</p>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-0.5 bg-gray-100 rounded-lg p-0.5">
              {(['qtd','pct'] as Modo[]).map(m=>(
                <button key={m} onClick={()=>setModo(m)}
                  className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${modo===m?'bg-white text-[#003087] shadow-sm':'text-gray-500 hover:text-gray-700'}`}>
                  {m==='qtd'?'QTD':'% do motivo'}
                </button>
              ))}
            </div>
            <div className="flex gap-0.5 bg-gray-100 rounded-lg p-0.5">
              {([['motivo','Por motivo'],['log','Logaritmica'],['global','Global']] as [Escala,string][]).map(([v,l])=>(
                <button key={v} onClick={()=>setEscala(v)}
                  className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${escala===v?'bg-[#F2C800] text-[#003087] shadow-sm':'text-gray-500 hover:text-gray-700'}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>
        </div>
        <HeatGrid
          linhas={motivosOrdenados}
          labelWidth={180}
          getVal={(m,d)=>getQtd(dados,m,d)}
          getMax={m=>Math.max(...DIAS_ISO.map(d=>getQtd(dados,m,d)),1)}
          maxGlobal={maxGlobalMotivo}
          escala={escala}
          getTotalLinha={m=>totaisLinha[m]}
          getTotalColuna={d=>dados.filter(x=>x.dia===d).reduce((s,x)=>s+x.qtd,0)}
          totalGeral={totalGeralMotivo}
          renderLabel={m=><p className="text-gray-600 text-xs truncate pr-2" title={m}>{m}</p>}
          exibir={exibirMotivo}
        />
      </div>

      {/* ── 2. Faixa Horária × Dia ── */}
      {faixas.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

          {/* Heatmap faixa × dia (ocupa 3/5) */}
          <div className="lg:col-span-3 bg-white border border-gray-100 rounded-xl p-5 overflow-auto">
            <div className="mb-4">
              <p className="text-sm font-medium text-gray-700">Faixa Horaria × Dia da semana</p>
              <p className="text-xs text-gray-400 mt-0.5">Hora de encerramento da visita — hora real da devolucao</p>
            </div>
            <div className="min-w-[400px]">
              <div className="grid mb-1" style={{gridTemplateColumns:'110px repeat(7, 1fr) 60px'}}>
                <div/>
                {DIAS.map(d=>(
                  <p key={d} className="text-center text-gray-500 text-[10px] font-medium uppercase tracking-wider pb-1">{d}</p>
                ))}
                <p className="text-center text-gray-500 text-[10px] font-medium uppercase tracking-wider pb-1">Total</p>
              </div>

              {faixas.map(faixa=>(
                <div key={faixa} className="grid items-center gap-1 mb-1"
                  style={{gridTemplateColumns:'110px repeat(7, 1fr) 60px'}}>
                  <p className="text-gray-600 text-xs font-medium truncate pr-2">{faixa}</p>
                  {DIAS_ISO.map(dia=>{
                    const qtd = getQtdH(dadosHorario, faixa, dia)
                    const r   = qtd / maxGlobalHora
                    return (
                      <div key={dia}
                        title={`${faixa} — ${DIAS[dia-1]}: ${qtd} dev.`}
                        className="h-8 rounded-lg flex items-center justify-center border border-white/20"
                        style={{backgroundColor:heatColor(r)}}
                      >
                        {qtd>0 && <span className="text-[10px] font-bold" style={{color:textColor(r)}}>{qtd.toLocaleString('pt-BR')}</span>}
                      </div>
                    )
                  })}
                  <div className="h-8 rounded-lg flex items-center justify-center bg-gray-50 border border-gray-200">
                    <span className="text-[10px] font-bold text-gray-600">{totaisHoraLinha[faixa].toLocaleString('pt-BR')}</span>
                  </div>
                </div>
              ))}

              {/* Totais coluna */}
              <div className="grid items-center gap-1 mt-2 pt-2 border-t border-gray-100"
                style={{gridTemplateColumns:'110px repeat(7, 1fr) 60px'}}>
                <p className="text-xs font-semibold text-gray-500">Total</p>
                {totaisHoraColuna.map((qtd,i)=>{
                  const r = qtd/Math.max(...totaisHoraColuna,1)
                  return (
                    <div key={i} className="h-8 rounded-lg flex items-center justify-center border border-white/20"
                      style={{backgroundColor:heatColor(r)}}>
                      <span className="text-[10px] font-bold" style={{color:textColor(r)}}>{qtd.toLocaleString('pt-BR')}</span>
                    </div>
                  )
                })}
                <div className="h-8 rounded-lg flex items-center justify-center bg-[#003087]">
                  <span className="text-[10px] font-bold text-white">{totalGeralHora.toLocaleString('pt-BR')}</span>
                </div>
              </div>
              <LegendaGradiente/>
            </div>
          </div>

          {/* Ranking faixas (ocupa 2/5) */}
          <div className="lg:col-span-2 bg-white border border-gray-100 rounded-xl p-5">
            <p className="text-sm font-medium text-gray-700 mb-1">Distribuicao por faixa</p>
            <p className="text-xs text-gray-400 mb-4">{totalGeralHora.toLocaleString('pt-BR')} devoluções</p>
            <div className="space-y-3">
              {[...chartFaixas].sort((a,b)=>b.qtd-a.qtd).map((item,i)=>{
                const barW = (item.qtd/maxFaixaQtd)*100
                const r    = item.qtd/maxFaixaQtd
                return (
                  <div key={item.faixa} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-700">{item.faixa}</span>
                      <span className="text-xs text-gray-400">{item.pct}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                        <div className="h-full rounded-full" style={{width:`${barW}%`,backgroundColor:heatColor(r)}}/>
                      </div>
                      <span className="text-xs font-bold text-gray-700 w-12 text-right shrink-0">
                        {item.qtd.toLocaleString('pt-BR')}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

        </div>
      )}
    </div>
  )
}

/* ════════════════════════════════════════════════════════
   ABA: Classificação × Dia
   ════════════════════════════════════════════════════════ */
function TabClassificacao({ dados }: { dados: CelulaClass[] }) {
  const classificacoes = [...new Set(dados.map(d=>d.classificacao))].sort()
  const totalGeral     = dados.reduce((s,d)=>s+d.qtd, 0)
  const totaisCls      = Object.fromEntries(classificacoes.map(c=>[c, dados.filter(d=>d.classificacao===c).reduce((s,d)=>s+d.qtd,0)]))
  const maxPorCls      = Object.fromEntries(classificacoes.map(c=>[c, Math.max(...DIAS_ISO.map(d=>getQtdC(dados,c,d)),1)]))

  const chartData = DIAS.map((label,i)=>{
    const dia = i+1
    const row: Record<string,any> = {dia:label}
    for (const cls of classificacoes) row[cls] = getQtdC(dados,cls,dia)
    return row
  })

  if (!dados.length) return (
    <div className="bg-white border border-gray-100 rounded-xl p-5 text-center text-sm text-gray-400 py-10">
      Sem dados de classificacao para o periodo selecionado.
    </div>
  )

  return (
    <div className="space-y-4">
      {/* Mini heatmap */}
      <div className="bg-white border border-gray-100 rounded-xl p-5 overflow-auto">
        <p className="text-sm font-medium text-gray-700 mb-4">Classificacao × Dia da semana</p>
        <div className="min-w-[480px]">
          <div className="grid mb-1" style={{gridTemplateColumns:'160px repeat(7, 1fr) 64px'}}>
            <div/>
            {DIAS.map(d=>(
              <p key={d} className="text-center text-gray-500 text-[10px] font-medium uppercase tracking-wider pb-1">{d}</p>
            ))}
            <p className="text-center text-gray-500 text-[10px] font-medium uppercase tracking-wider pb-1">Total</p>
          </div>
          {classificacoes.map(cls=>{
            const cor = corClass(cls)
            return (
              <div key={cls} className="grid items-center gap-1 mb-1"
                style={{gridTemplateColumns:'160px repeat(7, 1fr) 64px'}}>
                <div className="flex items-center gap-1.5 pr-2">
                  <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{backgroundColor:cor}}/>
                  <p className="text-xs text-gray-700 font-medium truncate">{cls}</p>
                </div>
                {DIAS_ISO.map(dia=>{
                  const qtd = getQtdC(dados,cls,dia)
                  const r   = qtd/maxPorCls[cls]
                  const bg  = classHeatColor(r,cor)
                  return (
                    <div key={dia}
                      title={`${cls} — ${DIAS[dia-1]}: ${qtd} dev.`}
                      className="h-9 rounded-lg flex items-center justify-center border border-white/20"
                      style={{backgroundColor:bg}}
                    >
                      {qtd>0 && (
                        <span className="text-[10px] font-bold" style={{color:r>=0.6?'#FFFFFF':cor}}>
                          {qtd.toLocaleString('pt-BR')}
                        </span>
                      )}
                    </div>
                  )
                })}
                <div className="h-9 rounded-lg flex items-center justify-center bg-gray-50 border border-gray-200">
                  <span className="text-[10px] font-bold text-gray-600">{totaisCls[cls].toLocaleString('pt-BR')}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Gráfico empilhado */}
      <div className="bg-white border border-gray-100 rounded-xl p-5">
        <p className="text-sm font-medium text-gray-700 mb-4">Volume por dia — empilhado por classificacao</p>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData} margin={{top:4,right:16,left:-10,bottom:0}}>
            <CartesianGrid strokeDasharray="4 4" stroke="#F3F4F6" vertical={false}/>
            <XAxis dataKey="dia" tick={{fill:'#6B7280',fontSize:11}}/>
            <YAxis tick={{fill:'#6B7280',fontSize:10}}/>
            <Tooltip
              content={({active,payload,label}:any)=>{
                if (!active||!payload?.length) return null
                const total = payload.reduce((s:number,p:any)=>s+(p.value??0),0)
                return (
                  <div className="bg-white border border-gray-100 rounded-lg px-3 py-2 text-xs shadow-sm space-y-1">
                    <p className="font-medium text-gray-700 mb-1">{label}</p>
                    {[...payload].reverse().map((p:any)=>(
                      <p key={p.dataKey} style={{color:corClass(p.dataKey)}}>
                        {p.dataKey}: <strong>{p.value?.toLocaleString('pt-BR')}</strong>
                      </p>
                    ))}
                    <p className="text-gray-500 border-t border-gray-100 pt-1 mt-1">
                      Total: <strong>{total.toLocaleString('pt-BR')}</strong>
                    </p>
                  </div>
                )
              }}
            />
            <Legend formatter={(v)=><span className="text-xs text-gray-600">{v}</span>}/>
            {classificacoes.map(cls=>(
              <Bar key={cls} dataKey={cls} stackId="a" fill={corClass(cls)} fillOpacity={0.85}
                radius={cls===classificacoes[classificacoes.length-1]?[3,3,0,0]:undefined}/>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Cards resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {classificacoes.map(cls=>{
          const cor    = corClass(cls)
          const total  = totaisCls[cls]
          const pct    = totalGeral>0?((total/totalGeral)*100).toFixed(1):'0'
          const diaIdx = DIAS_ISO.reduce((mx,d)=>getQtdC(dados,cls,d)>getQtdC(dados,cls,mx)?d:mx, 1)
          return (
            <div key={cls} className="bg-white border border-gray-100 rounded-xl px-4 py-4"
              style={{borderLeftWidth:4,borderLeftColor:cor}}>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2.5 h-2.5 rounded-sm" style={{backgroundColor:cor}}/>
                <p className="text-sm font-semibold text-gray-700">{cls}</p>
              </div>
              <p className="text-2xl font-bold text-[#003087]">{total.toLocaleString('pt-BR')}</p>
              <p className="text-xs text-gray-400 mt-0.5">{pct}% do total</p>
              <p className="text-xs text-gray-500 mt-2">
                Pico: <span className="font-medium">{DIAS[diaIdx-1]}</span>{' '}
                — {getQtdC(dados,cls,diaIdx).toLocaleString('pt-BR')} dev.
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL — 2 tabs
   ════════════════════════════════════════════════════════ */
export function MapaCalor({ dados, dadosClass, dadosHorario }: Props) {
  const [tab, setTab] = useState<Tab>('motivo')

  return (
    <div className="space-y-4">
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {([['motivo','Motivo × Dia'],['classificacao','Classificacao × Dia']] as [Tab,string][]).map(([id,label])=>(
          <button key={id} onClick={()=>setTab(id)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab===id?'bg-white text-[#003087] shadow-sm':'text-gray-500 hover:text-gray-700'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {tab==='motivo'
        ? <TabMotivo dados={dados} dadosHorario={dadosHorario}/>
        : <TabClassificacao dados={dadosClass}/>
      }
    </div>
  )
}
