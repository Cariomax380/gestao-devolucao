'use client'

import React, { useState, useMemo, useTransition, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import {
  ComposedChart, Bar, Cell, ReferenceLine,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import type { GatilhoDia, GatilhoMotorista, GatilhoRelato } from '@/types'
import { criarRelato, editarRelato, resetarRelato, buscarDetalheGatilhoPdv, type RelatoInput, type DetalheGatilhoPdv } from './actions'

interface Props {
  geral:      GatilhoDia[]
  total:      GatilhoMotorista[]
  fechado:    GatilhoMotorista[]
  relatos:    Record<string, GatilhoRelato>
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

/** Normaliza para 2 casas decimais (precisão do SQL) antes do ceil,
 *  evitando drift de ponto flutuante que inflaria o limiar em +1. */
function applyLimiar(raw: number): number {
  return Math.ceil(Math.round(raw * 100) / 100)
}

/** Formata limiar: inteiro sem decimais, float com 1 casa. */
function fmtLimiar(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1)
}

type Zona = 'critica' | 'atencao' | 'normal'

function getZona(valor: number, media: number, desvio: number, sigma: number): Zona {
  if (valor > media + sigma * desvio) return 'critica'
  if (valor > media + desvio)         return 'atencao'
  return 'normal'
}

// Zona relativa ao limiar único de frota (TabMotoristas)
function getZonaFrota(valor: number, limiar: number): Zona {
  if (valor > limiar)        return 'critica'
  if (valor >= limiar * 0.7) return 'atencao'
  return 'normal'
}

const ZONA: Record<Zona, { label: string; bg: string; text: string; rowBg: string }> = {
  critica: { label: 'Crítica', bg: '#FEE2E2', text: '#DC2626', rowBg: '#FFF5F5' },
  atencao: { label: 'Atenção', bg: '#FEF3C7', text: '#D97706', rowBg: '#FFFDF0' },
  normal:  { label: 'Normal',  bg: '#D1FAE5', text: '#059669', rowBg: ''        },
}

const STATUS_RELATO: Record<GatilhoRelato['status'], { label: string; bg: string; text: string }> = {
  relatado:          { label: 'Relatado',      bg: '#D1FAE5', text: '#059669' },
  em_acompanhamento: { label: 'Em acomp.',     bg: '#FEF3C7', text: '#D97706' },
  concluido:         { label: 'Concluído',     bg: '#DBEAFE', text: '#2563EB' },
}

const CATEGORIA: Record<string, { label: string; bg: string; text: string }> = {
  operacional: { label: 'Operacional', bg: '#DBEAFE', text: '#1D4ED8' },
  comercial:   { label: 'Comercial',   bg: '#EDE9FE', text: '#7C3AED' },
  externo:     { label: 'Externo',     bg: '#D1FAE5', text: '#059669' },
  sistemico:   { label: 'Sistêmico',   bg: '#FEE2E2', text: '#DC2626' },
}

// ── Helpers SLA ───────────────────────────────────────────────────────────────

/** Dias corridos desde a data da rota até hoje */
function diasPendente(data_rota: string): number {
  const [y, m, d] = data_rota.split('-').map(Number)
  const rota = new Date(y, m - 1, d)
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  return Math.max(0, Math.floor((hoje.getTime() - rota.getTime()) / 86_400_000))
}

function corSLA(dias: number): { bg: string; text: string } {
  if (dias <= 1) return { bg: '#D1FAE5', text: '#059669' }
  if (dias <= 3) return { bg: '#FEF3C7', text: '#D97706' }
  return { bg: '#FEE2E2', text: '#DC2626' }
}

// ── Export CSV ────────────────────────────────────────────────────────────────

function baixarCSV(nome: string, linhas: (string | number)[][]) {
  const bom      = '﻿'
  const csv      = bom + linhas.map(l => l.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob     = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url      = URL.createObjectURL(blob)
  const a        = document.createElement('a')
  a.href         = url
  a.download     = nome
  a.click()
  URL.revokeObjectURL(url)
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
  const cor   = pct > 100 ? '#EF4444' : pct >= 70 ? '#F59E0B' : '#10B981'
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

function TooltipDia({ active, payload }: { active?: boolean; payload?: { payload: GatilhoDia }[] }) {
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

function TopOfensores({ dados, medianLimiar }: { dados: GatilhoMotorista[]; medianLimiar: number }) {
  const top: Ofensor[] = useMemo(() => {
    const mapa = new Map<string, Ofensor>()
    for (const m of dados) {
      const limiar = medianLimiar
      if (m.devs_dia <= limiar) continue
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
  }, [dados, medianLimiar])

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

// ── helpers 5 Porquês ────────────────────────────────────────────────────────

function Popover5P({ porques }: { porques: string[] }) {
  const [open, setOpen] = useState(false)
  const [pos,  setPos]  = useState({ top: 0, left: 0 })
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onOutside)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onOutside)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function handleToggle(e: React.MouseEvent) {
    e.stopPropagation()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    // Posiciona abaixo do ícone; ajusta para não sair da tela pela direita
    const left = Math.min(rect.left, window.innerWidth - 300)
    setPos({ top: rect.bottom + 6, left })
    setOpen(v => !v)
  }

  const filled = porques.filter(p => p.trim())

  return (
    <span ref={ref} className="inline-block">
      <button
        type="button"
        onClick={handleToggle}
        className="cursor-pointer select-none text-sm leading-none hover:scale-110 transition-transform"
        aria-label="Ver análise 5 Porquês"
      >
        🔍
      </button>
      {open && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed z-[300] bg-white border border-gray-200 rounded-xl shadow-2xl p-4 w-72"
          style={{ top: pos.top, left: pos.left }}
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-[#003087] uppercase tracking-wider">5 Porquês · Causa Raiz</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-gray-400 hover:text-gray-600 text-base leading-none"
            >
              ✕
            </button>
          </div>
          <ol className="space-y-2.5">
            {filled.map((p, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="w-5 h-5 rounded-full bg-[#003087]/10 text-[#003087] text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <p className="text-xs text-gray-700 leading-relaxed">{p}</p>
              </li>
            ))}
          </ol>
        </div>,
        document.body
      )}
    </span>
  )
}

// ── RelatoCardPopover ─────────────────────────────────────────────────────────

function RelatoCardPopover({ relato, onEdit }: { relato: GatilhoRelato; onEdit: () => void }) {
  const [open,         setOpen        ] = useState(false)
  const [pos,          setPos         ] = useState({ top: 0, left: 0 })
  const [confirmReset, setConfirmReset] = useState(false)
  const [resetting,    setResetting   ] = useState(false)
  const [resetError,   setResetError  ] = useState<string | null>(null)
  const triggerRef = useRef<HTMLDivElement>(null)
  const portalRef  = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onOutside(e: MouseEvent) {
      const t = e.target as Node
      if (triggerRef.current?.contains(t) || portalRef.current?.contains(t)) return
      setOpen(false)
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onOutside)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onOutside)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function handleToggle(e: React.MouseEvent) {
    e.stopPropagation()
    const rect   = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const W      = 320   // w-80
    const H      = 420   // approximate max card height
    // Horizontal: right-align to trigger so card opens leftward (avoids viewport overflow)
    const left   = Math.max(8, Math.min(rect.right - W, window.innerWidth - W - 8))
    // Vertical: open below if enough space, otherwise above
    const top    = window.innerHeight - rect.bottom >= H
      ? rect.bottom + 6
      : Math.max(8, rect.top - H - 6)
    setPos({ top, left })
    setConfirmReset(false)
    setResetError(null)
    setOpen(v => !v)
  }

  async function handleReset() {
    setResetting(true)
    setResetError(null)
    const result = await resetarRelato(relato.id)
    setResetting(false)
    if (result.error) {
      setResetError(result.error)
      return
    }
    setOpen(false)
    setConfirmReset(false)
  }

  const relStatus = STATUS_RELATO[relato.status]
  const catInfo   = relato.categoria ? CATEGORIA[relato.categoria] : null
  const filled5P  = relato.cinco_porques?.filter(p => p.trim()) ?? []

  return (
    <div ref={triggerRef} className="flex flex-col items-center gap-0.5">
      <button
        type="button"
        onClick={handleToggle}
        className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide whitespace-nowrap hover:opacity-80 transition-opacity"
        style={{ backgroundColor: relStatus.bg, color: relStatus.text }}
      >
        ✓ {relStatus.label}
      </button>
      {catInfo && (
        <span
          className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide"
          style={{ backgroundColor: catInfo.bg, color: catInfo.text }}
        >
          {catInfo.label}
        </span>
      )}
      {open && typeof document !== 'undefined' && createPortal(
        <div
          ref={portalRef}
          className="fixed z-[300] bg-white border border-gray-200 rounded-2xl shadow-2xl w-80 overflow-hidden"
          style={{ top: pos.top, left: pos.left }}
        >
          <div className="bg-[#003087] text-white px-4 py-3 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide"
                  style={{ backgroundColor: relStatus.bg, color: relStatus.text }}
                >
                  ✓ {relStatus.label}
                </span>
                {catInfo && (
                  <span
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide"
                    style={{ backgroundColor: catInfo.bg, color: catInfo.text }}
                  >
                    {catInfo.label}
                  </span>
                )}
              </div>
              {relato.responsavel && (
                <p className="text-xs text-blue-200 mt-1 truncate">{relato.responsavel}</p>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={e => { e.stopPropagation(); setOpen(false); onEdit() }}
                className="text-[10px] bg-white/15 hover:bg-white/25 text-white rounded-md px-2 py-1 transition-colors font-semibold flex items-center gap-1"
              >
                ✏ Editar
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-blue-300 hover:text-white transition-colors text-sm leading-none"
              >
                ✕
              </button>
            </div>
          </div>
          <div className="p-4 space-y-3 max-h-72 overflow-y-auto">
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Relato</p>
              <p className="text-sm text-gray-700 leading-relaxed">{relato.relato}</p>
            </div>
            {filled5P.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-[#003087] uppercase tracking-wider mb-2">5 Porquês · Causa Raiz</p>
                <ol className="space-y-2">
                  {filled5P.map((p, i) => (
                    <li key={i} className="flex gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-[#003087]/10 text-[#003087] text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      <p className="text-xs text-gray-700 leading-relaxed">{p}</p>
                    </li>
                  ))}
                </ol>
              </div>
            )}
            <p className="text-[10px] text-gray-300 border-t border-gray-100 pt-2">
              Registrado em {new Date(relato.criado_em).toLocaleDateString('pt-BR')}
            </p>
          </div>
          {/* Rodapé reset */}
          {!confirmReset ? (
            <div className="px-4 pb-3">
              <button
                type="button"
                onClick={e => { e.stopPropagation(); setConfirmReset(true) }}
                className="text-[10px] text-gray-400 hover:text-red-500 transition-colors underline underline-offset-2"
              >
                ↩ Resetar relato
              </button>
            </div>
          ) : (
            <div className="bg-red-50 border-t border-red-100 px-4 py-3">
              <p className="text-xs font-medium text-red-600 mb-2">
                Apagar este relato? Não há desfazer.
              </p>
              {resetError && (
                <p className="text-[10px] text-red-500 mb-2">{resetError}</p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); setConfirmReset(false); setResetError(null) }}
                  disabled={resetting}
                  className="flex-1 text-xs py-1.5 rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-40"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); handleReset() }}
                  disabled={resetting}
                  className="flex-1 text-xs py-1.5 rounded-md bg-red-500 hover:bg-red-600 text-white font-semibold transition-colors disabled:opacity-40"
                >
                  {resetting ? 'Apagando…' : 'Apagar'}
                </button>
              </div>
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  )
}

function CincoPorques({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  // Exibe P(i+1) apenas quando P(i) já tem conteúdo — progressão obrigada
  const emptyIdx  = value.findIndex(p => !p.trim())
  const showCount = emptyIdx === -1 ? 5 : Math.min(emptyIdx + 1, 5)

  return (
    <div className="space-y-3 border-l-2 border-[#003087]/20 pl-3 pt-1">
      {Array.from({ length: showCount }, (_, i) => {
        const prev          = i > 0 ? value[i - 1].trim() : ''
        const prevTruncated = prev.length > 55 ? `${prev.slice(0, 55)}…` : prev
        return (
          <div key={i}>
            <label className="block text-xs font-semibold text-[#003087]/70 mb-1">
              P{i + 1} — {i === 0 ? 'Por que o estouro aconteceu?' : `Por que "${prevTruncated}"?`}
            </label>
            <textarea
              value={value[i]}
              onChange={e => onChange(value.map((v, j) => (j === i ? e.target.value : v)))}
              rows={2}
              placeholder={i < 4 ? `Causa ${i + 1} de 5…` : 'Causa raiz identificada'}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#003087] focus:outline-none resize-none"
            />
          </div>
        )
      })}
      {showCount === 5 && value[4].trim() && (
        <p className="text-xs text-emerald-600 font-semibold flex items-center gap-1.5">
          <span>✓</span> Causa raiz identificada em P5
        </p>
      )}
    </div>
  )
}

// ── RelatoModal ──────────────────────────────────────────────────────────────

type RelatoModalProps =
  | { variante: 'motorista'; m: GatilhoMotorista; limiar: number; tipo: 'total' | 'fechado'; onClose: () => void; editRelato?: GatilhoRelato }
  | { variante: 'geral'; d: GatilhoDia; gatilho: number; onClose: () => void; editRelato?: GatilhoRelato }

function RelatoModal(props: RelatoModalProps) {
  const { onClose, editRelato } = props
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [relato,      setRelato]      = useState(() => editRelato?.relato ?? '')
  const [responsavel, setResponsavel] = useState(() => editRelato?.responsavel ?? '')
  const [status,      setStatus]      = useState<GatilhoRelato['status']>(() => editRelato?.status ?? 'relatado')
  const [gerarAcao,   setGerarAcao]   = useState(false)
  const [erro,        setErro]        = useState<string | null>(null)
  const [aplicar5p,   setAplicar5p]   = useState(() => !!(editRelato?.cinco_porques?.length))
  const [porques,     setPorques]     = useState<string[]>(() => {
    const arr = editRelato?.cinco_porques ? [...editRelato.cinco_porques] : []
    while (arr.length < 5) arr.push('')
    return arr.slice(0, 5)
  })
  const [categoria,   setCategoria]   = useState(() => editRelato?.categoria ?? '')

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!relato.trim()) return
    setErro(null)
    startTransition(async () => {
      const cincoP = aplicar5p ? porques : undefined
      const catVal = (categoria || undefined) as RelatoInput['categoria']
      if (editRelato) {
        const result = await editarRelato({
          id:          editRelato.id,
          relato:      relato.trim(),
          responsavel: responsavel.trim() || undefined,
          status,
          cincoP,
          categoria:   catVal,
        })
        if (result.error) { setErro(result.error); return }
      } else if (props.variante === 'geral') {
        const result = await criarRelato({
          motorista:   '',
          data_rota:   props.d.data_rota,
          tipo:        'geral',
          devs_dia:    props.d.pct_dev,
          limiar:      props.gatilho,
          relato:      relato.trim(),
          responsavel: responsavel.trim() || undefined,
          status,
          gerarAcao,
          cincoP,
          categoria:   catVal,
        })
        if (result.error) { setErro(result.error); return }
      } else {
        const result = await criarRelato({
          motorista:   props.m.motorista,
          data_rota:   props.m.data_rota,
          tipo:        props.tipo,
          devs_dia:    props.m.devs_dia,
          limiar:      props.limiar,
          relato:      relato.trim(),
          responsavel: responsavel.trim() || undefined,
          status,
          gerarAcao,
          cincoP,
          categoria:   catVal,
        })
        if (result.error) { setErro(result.error); return }
      }
      router.refresh()
      onClose()
    })
  }

  const isGeral = props.variante === 'geral'
  const modalId = isGeral ? 'relato-geral-modal-title' : 'relato-modal-title'

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={modalId}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 flex flex-col max-h-[88vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#003087] text-white px-6 py-4 shrink-0">
          {isGeral ? (
            <>
              <p className="text-xs font-medium text-blue-200 uppercase tracking-wider mb-0.5">
                {editRelato ? 'Editar relato' : 'Relato de estouro'} — Devolução Geral (frota)
              </p>
              <h3 id={modalId} className="font-bold text-lg leading-tight">{fmtData(props.d.data_rota)}</h3>
              <p className="text-blue-200 text-sm">{props.d.pdvs_fat.toLocaleString()} faturados · {props.d.pdvs_dev} devolvidos</p>
            </>
          ) : (
            <>
              <p className="text-xs font-medium text-blue-200 uppercase tracking-wider mb-0.5">
                {editRelato ? 'Editar relato' : 'Relato de estouro'} — {props.tipo === 'total' ? 'Dev. Total' : 'PDV Fechado'}
              </p>
              <h3 id={modalId} className="font-bold text-lg leading-tight">{props.m.nome_motorista}</h3>
              <p className="text-blue-200 text-sm">{fmtData(props.m.data_rota)} · {props.m.motorista}</p>
            </>
          )}
        </div>

        {/* Info pills */}
        <div className="px-6 py-3 bg-red-50 border-b border-red-100 flex gap-5 text-sm shrink-0">
          {isGeral ? (
            <>
              <span className="text-gray-600">% Dev: <strong className="text-red-600">{props.d.pct_dev.toFixed(2)}%</strong></span>
              <span className="text-gray-600">Gatilho: <strong className="text-gray-800">{props.gatilho.toFixed(2)}%</strong></span>
              <span className="text-gray-600">Δ: <strong className="text-red-600">+{(props.d.pct_dev - props.gatilho).toFixed(2)}%</strong></span>
            </>
          ) : (
            <>
              <span className="text-gray-600">Dev. Dia: <strong className="text-red-600">{props.m.devs_dia}</strong></span>
              <span className="text-gray-600">Limiar: <strong className="text-gray-800">{props.limiar}</strong></span>
              <span className="text-gray-600">Δ: <strong className="text-red-600">+{fmtLimiar(props.m.devs_dia - props.limiar)}</strong></span>
            </>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              Relato *
            </label>
            <textarea
              value={relato}
              onChange={e => setRelato(e.target.value)}
              rows={4}
              required
              maxLength={2000}
              placeholder={isGeral
                ? 'Descreva o contexto do estouro de frota, causas e ações tomadas...'
                : 'Descreva o que foi apurado, causa identificada, ação tomada...'}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:border-[#003087] focus:outline-none resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                Responsável
              </label>
              <input
                type="text"
                value={responsavel}
                onChange={e => setResponsavel(e.target.value)}
                placeholder="Nome do responsável"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#003087] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                Status
              </label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as GatilhoRelato['status'])}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#003087] focus:outline-none bg-white"
              >
                <option value="relatado">Relatado</option>
                <option value="em_acompanhamento">Em acompanhamento</option>
                <option value="concluido">Concluído</option>
              </select>
            </div>
          </div>

          {/* Categoria da causa raiz */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              Categoria da causa raiz
            </label>
            <select
              value={categoria}
              onChange={e => setCategoria(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#003087] focus:outline-none bg-white"
            >
              <option value="">Não categorizado</option>
              <option value="operacional">Operacional</option>
              <option value="comercial">Comercial</option>
              <option value="externo">Externo</option>
              <option value="sistemico">Sistêmico</option>
            </select>
          </div>

          {/* Checkbox gerar plano de ação — só visível no modo criar */}
          {!editRelato && (
            <label className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-100 rounded-lg cursor-pointer select-none">
              <input
                type="checkbox"
                checked={gerarAcao}
                onChange={e => setGerarAcao(e.target.checked)}
                className="mt-0.5 accent-[#003087]"
              />
              <div>
                <p className="text-sm font-semibold text-gray-700">Gerar item no Plano de Ação</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {isGeral
                    ? 'Cria uma ação de prioridade alta para este estouro de frota'
                    : 'Cria uma ação de prioridade alta vinculada a este estouro'}
                </p>
              </div>
            </label>
          )}

          {/* 5 Porquês — análise de causa raiz */}
          <div className="border border-[#003087]/10 rounded-lg overflow-hidden">
            <label className="flex items-center gap-3 p-3 cursor-pointer select-none bg-blue-50/60 hover:bg-blue-50 transition-colors">
              <input
                type="checkbox"
                checked={aplicar5p}
                onChange={e => setAplicar5p(e.target.checked)}
                className="accent-[#003087]"
              />
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-700">Aplicar análise 5 Porquês</p>
                <p className="text-xs text-gray-500 mt-0.5">Identifica a causa raiz progressivamente — pergunta por pergunta</p>
              </div>
              <span className="text-base select-none">🔍</span>
            </label>
            {aplicar5p && (
              <div className="px-3 pb-3 pt-2">
                <CincoPorques value={porques} onChange={setPorques} />
              </div>
            )}
          </div>

          {erro && (
            <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{erro}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="flex-1 border border-gray-200 rounded-lg py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending || !relato.trim()}
              className="flex-1 bg-[#003087] text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-[#002070] transition-colors disabled:opacity-50"
            >
              {isPending ? 'Salvando...' : editRelato ? 'Atualizar Relato' : 'Salvar Relato'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── TabGeral ──────────────────────────────────────────────────────────────────

interface TabGeralProps {
  dados:      GatilhoDia[]
  gatilho:    number
  media:      number
  desvio:     number
  sigma:      number
  periodoRef: string
  relatos:    Record<string, GatilhoRelato>
}

function TabGeral({ dados, gatilho, media, desvio, sigma, periodoRef, relatos }: TabGeralProps) {
  const [modalDados, setModalDados] = useState<GatilhoDia | null>(null)
  const [editModal,  setEditModal]  = useState<GatilhoRelato | null>(null)

  const geralKey  = (d: GatilhoDia) => `|${d.data_rota}|geral`
  const geralMax  = Math.max(...dados.map(d => Math.max(d.pct_dev, gatilho)), 1)
  const estouros  = dados.filter(d => d.pct_dev > gatilho)
  const semRelato = estouros.filter(d => !relatos[geralKey(d)]).length

  function handleExport() {
    const header = ['Data', 'Faturados', 'Devolvidos', '% Dev', 'Gatilho %', 'Δ%', 'Zona', 'Status Relato', 'Responsável', 'Categoria', 'Relato', 'P1', 'P2', 'P3', 'P4', 'P5']
    const linhas = [header, ...dados.map(d => {
      const rel  = relatos[geralKey(d)]
      const zona = getZona(d.pct_dev, media, desvio, sigma)
      const p5   = Array.from({ length: 5 }, (_, i) => rel?.cinco_porques?.[i] ?? '')
      return [d.data_rota, d.pdvs_fat, d.pdvs_dev, d.pct_dev.toFixed(2), gatilho.toFixed(2), (d.pct_dev - gatilho).toFixed(2), zona, rel?.status ?? '', rel?.responsavel ?? '', rel?.categoria ?? '', rel?.relato ?? '', ...p5]
    })]
    baixarCSV(`gatilho-geral-${periodoRef.replace(/\//g, '-')}.csv`, linhas)
  }

  return (
    <div className="space-y-4">
      {dados[0] && (
        <div className="bg-[#FFF8DC] border border-[#F2C800]/40 rounded-xl px-5 py-3 flex flex-wrap gap-x-8 gap-y-1.5 text-sm">
          <span className="text-gray-600">μ: <strong className="text-[#D4A800]">{media.toFixed(2)}%</strong></span>
          <span className="text-gray-600">σ: <strong className="text-[#D4A800]">{desvio.toFixed(2)}%</strong></span>
          <span className="text-gray-600">
            Gatilho ({sigma}σ): <strong className="text-red-500">{gatilho.toFixed(2)}%</strong>
          </span>
          {estouros.length > 0 && semRelato > 0 && (
            <span className="text-orange-500 text-xs font-semibold self-center">⚠ {semRelato} sem relato</span>
          )}
          {estouros.length > 0 && semRelato === 0 && (
            <span className="text-emerald-600 text-xs font-semibold self-center">✓ todos relatados</span>
          )}
          <span className="text-gray-400 text-xs self-center">Referência: {periodoRef}</span>
          <button
            onClick={handleExport}
            className="ml-auto text-xs font-semibold text-[#003087] hover:text-[#0057A8] transition-colors flex items-center gap-1 self-center"
          >
            ↓ Exportar CSV
          </button>
        </div>
      )}

      {dados.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <p className="text-xs font-medium text-gray-400 mb-3">Evolução diária % Dev vs Gatilho</p>
          <ResponsiveContainer width="100%" height={160}>
            <ComposedChart data={dados} margin={{ left: 0, right: 24, top: 4 }}>
              <CartesianGrid strokeDasharray="4 4" stroke="#F3F4F6" />
              <XAxis dataKey="data_rota" tickFormatter={fmtData} tick={{ fontSize: 10, fill: '#6B7280' }} />
              <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 10, fill: '#6B7280' }} domain={[0, Math.ceil(geralMax * 1.2)]} />
              <Tooltip content={<TooltipDia />} />
              <ReferenceLine
                y={gatilho}
                stroke="#EF4444"
                strokeDasharray="6 3"
                strokeWidth={1.5}
                label={{ value: `${gatilho.toFixed(2)}%`, fill: '#EF4444', fontSize: 10, position: 'insideTopRight' }}
              />
              <Bar dataKey="pct_dev" radius={[2, 2, 0, 0]}>
                {dados.map((d, i) => (
                  <Cell key={i} fill={d.pct_dev > gatilho ? '#EF4444' : '#0057A8'} fillOpacity={d.pct_dev > gatilho ? 1 : 0.65} />
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
                <th className="text-center py-2.5 px-4">Relato</th>
              </tr>
            </thead>
            <tbody>
              {dados.map(d => {
                const zona      = getZona(d.pct_dev, media, desvio, sigma)
                const c         = ZONA[zona]
                const isEstouro = d.pct_dev > gatilho
                const relExist  = relatos[geralKey(d)]
                const relStatus = relExist ? STATUS_RELATO[relExist.status] : null
                const dias      = diasPendente(d.data_rota)
                const sla       = corSLA(dias)
                const catInfo   = relExist?.categoria ? CATEGORIA[relExist.categoria] : null
                return (
                  <tr key={d.data_rota} className="border-b border-gray-50" style={{ backgroundColor: zona !== 'normal' ? c.rowBg : undefined }}>
                    <td className="py-2.5 px-4 font-semibold text-[#003087]">{fmtData(d.data_rota)}</td>
                    <td className="py-2.5 px-4 text-right text-gray-400 text-xs">{d.pdvs_fat.toLocaleString()}</td>
                    <td className="py-2.5 px-4 text-right text-gray-600">{d.pdvs_dev}</td>
                    <td className="py-2.5 px-4 text-right font-bold" style={{ color: zona === 'critica' ? '#DC2626' : '#003087' }}>
                      {d.pct_dev.toFixed(2)}%
                    </td>
                    <td className="py-2.5 px-4"><UsoBarra valor={d.pct_dev} gatilho={gatilho} /></td>
                    <td className="py-2.5 px-4 text-center"><ZonaBadge zona={zona} /></td>
                    <td className="py-2.5 px-4 text-center">
                      {isEstouro ? (
                        relStatus ? (
                          <RelatoCardPopover
                            relato={relExist!}
                            onEdit={() => { setEditModal(relExist!); setModalDados(d) }}
                          />
                        ) : (
                          <button
                            onClick={() => setModalDados(d)}
                            className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide whitespace-nowrap transition-colors"
                            style={{ backgroundColor: sla.bg, color: sla.text }}
                          >
                            ⚠ Pendente · {dias}d
                          </button>
                        )
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
              {dados.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-400 text-sm">
                    Selecione um mês para calcular o gatilho.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalDados && (
        <RelatoModal
          variante="geral"
          d={modalDados}
          gatilho={gatilho}
          editRelato={editModal ?? undefined}
          onClose={() => { setModalDados(null); setEditModal(null) }}
        />
      )}
    </div>
  )
}

// ── DrilldownPdvFechado ───────────────────────────────────────────────────────

const STATUS_PDV_COR: Record<string, { bg: string; text: string }> = {
  devolvido:          { bg: '#FEE2E2', text: '#DC2626' },
  devolvido_parcial:  { bg: '#FEF3C7', text: '#D97706' },
  reagendado:         { bg: '#DBEAFE', text: '#2563EB' },
  tratativa_aberta:   { bg: '#FEF9C3', text: '#CA8A04' },
  em_tratamento:      { bg: '#EDE9FE', text: '#7C3AED' },
  entregue:           { bg: '#D1FAE5', text: '#059669' },
}

function DrilldownPdvFechado({ pdvs }: { pdvs: DetalheGatilhoPdv[] | 'erro' | undefined }) {
  if (pdvs === undefined) {
    return (
      <div className="flex items-center gap-2 py-2 text-xs text-gray-400">
        <span className="inline-block w-3 h-3 border-2 border-blue-300 border-t-transparent rounded-full animate-spin" />
        Carregando PDVs…
      </div>
    )
  }
  if (pdvs === 'erro') {
    return <p className="text-xs text-red-500 py-2">Erro ao carregar detalhes.</p>
  }
  if (!pdvs.length) {
    return <p className="text-xs text-gray-400 py-2">Nenhum PDV fechado encontrado para este dia.</p>
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs min-w-[640px]">
        <thead>
          <tr className="text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-blue-100">
            <th className="text-left py-1.5 pr-4 whitespace-nowrap">Código PDV</th>
            <th className="text-left py-1.5 pr-4">Cliente</th>
            <th className="text-left py-1.5 pr-4 whitespace-nowrap">Status</th>
            <th className="text-left py-1.5 pr-4">Classificação</th>
            <th className="text-center py-1.5 pr-4 whitespace-nowrap">Recidência</th>
            <th className="text-left py-1.5 pr-4 whitespace-nowrap">Horário</th>
            <th className="text-left py-1.5">Responsável / Resultado</th>
          </tr>
        </thead>
        <tbody>
          {pdvs.map((p, i) => {
            const sCor = p.status_final ? (STATUS_PDV_COR[p.status_final] ?? { bg: '#F3F4F6', text: '#6B7280' }) : null
            return (
              <tr key={p.codigo_pdv ?? i} className="border-b border-blue-50 last:border-0">
                <td className="py-1.5 pr-4 font-mono font-semibold text-[#003087]">
                  {p.codigo_pdv ?? '—'}
                </td>
                <td className="py-1.5 pr-4 max-w-[180px] truncate text-gray-700" title={p.cliente ?? ''}>
                  {p.cliente ?? '—'}
                </td>
                <td className="py-1.5 pr-4">
                  {sCor ? (
                    <span
                      className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase whitespace-nowrap"
                      style={{ backgroundColor: sCor.bg, color: sCor.text }}
                    >
                      {p.status_final}
                    </span>
                  ) : '—'}
                </td>
                <td className="py-1.5 pr-4 text-gray-500 max-w-[140px] truncate" title={p.classificacao_motivo ?? ''}>
                  {p.classificacao_motivo ?? '—'}
                </td>
                <td className="py-1.5 pr-4 text-center">
                  {(p.recorrencia_pdv ?? 0) > 1
                    ? <span className="font-bold text-orange-600">{p.recorrencia_pdv}x</span>
                    : <span className="text-gray-300">—</span>}
                </td>
                <td className="py-1.5 pr-4 font-mono text-gray-500 whitespace-nowrap">
                  {p.horario_apontamento ?? '—'}
                </td>
                <td className="py-1.5 text-gray-500">
                  {p.responsavel_acionado
                    ? <><span className="text-gray-700">{p.responsavel_acionado}</span>{p.resultado_contato && <span className="text-gray-400"> · {p.resultado_contato}</span>}</>
                    : '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── TabMotoristas ─────────────────────────────────────────────────────────────
interface TabMotoristaProps {
  dados:        GatilhoMotorista[]
  filtrados:    GatilhoMotorista[]
  quase:        string[]
  /** Limiar mediano calculado no pai (usado no banner e nos KPI cards) */
  medianLimiar: number
  sigma:        number
  periodoRef:   string
  busca:        string
  soEstouro:    boolean
  onBusca:      (v: string) => void
  onSoEstouro:  (v: boolean) => void
  /** Tipo da aba — define a chave de lookup no mapa de relatos */
  tipo:         'total' | 'fechado'
  /** Mapa de relatos: chave = `${motorista}|${data_rota}|${tipo}` */
  relatos:      Record<string, GatilhoRelato>
}

type FiltroRelato = 'todos' | 'sem_relato' | 'com_relato'

function TabMotoristas({
  dados, filtrados, quase,
  medianLimiar, sigma, periodoRef,
  busca, soEstouro, onBusca, onSoEstouro,
  tipo, relatos,
}: TabMotoristaProps) {
  const [filtroRelato,  setFiltroRelato]  = useState<FiltroRelato>('todos')
  const [modalDados,    setModalDados]    = useState<{ m: GatilhoMotorista; limiar: number } | null>(null)
  const [editModal,     setEditModal]     = useState<GatilhoRelato | null>(null)
  const [expandedKey,   setExpandedKey]   = useState<string | null>(null)
  const [detailCache,   setDetailCache]   = useState<Record<string, DetalheGatilhoPdv[] | 'erro'>>({})
  const [, startDetail] = useTransition()

  function handleExpand(m: GatilhoMotorista) {
    const key = `${m.motorista}|${m.data_rota}`
    if (expandedKey === key) { setExpandedKey(null); return }
    setExpandedKey(key)
    if (!detailCache[key]) {
      startDetail(async () => {
        const res = await buscarDetalheGatilhoPdv(m.motorista, m.data_rota)
        setDetailCache(prev => ({ ...prev, [key]: res.data ?? 'erro' }))
      })
    }
  }

  const relatoKey = (m: GatilhoMotorista) => `${m.motorista}|${m.data_rota}|${tipo}`

  // Filtro secundário por status de relato (sobre filtrados já filtrados por busca/estouro)
  const filtradosVisiveis = useMemo(() => {
    if (filtroRelato === 'todos') return filtrados
    return filtrados.filter(m => {
      if (m.devs_dia <= medianLimiar) return false
      const temRelato = !!relatos[relatoKey(m)]
      return filtroRelato === 'sem_relato' ? !temRelato : temRelato
    })
  }, [filtrados, filtroRelato, relatos, tipo, medianLimiar])

  const estouros       = dados.filter(m => m.devs_dia > medianLimiar)
  const motoristasUniq = new Set(estouros.map(m => m.motorista)).size
  const diasUniq       = new Set(estouros.map(m => m.data_rota)).size
  const semRelato      = estouros.filter(m => !relatos[relatoKey(m)]).length

  // Mapa de reincidência: motorista → nº de dias em estouro no período
  const reincMap = useMemo(() => {
    const map: Record<string, number> = {}
    for (const m of dados) {
      if (m.devs_dia > medianLimiar) map[m.motorista] = (map[m.motorista] ?? 0) + 1
    }
    return map
  }, [dados, medianLimiar])

  // Mapa de última conclusão: motorista → data_rota mais recente com relato "concluido"
  const ultimaConclusaoMap = useMemo(() => {
    const map: Record<string, string> = {}
    for (const r of Object.values(relatos)) {
      if (r.status === 'concluido' && r.motorista && r.tipo === tipo) {
        if (!map[r.motorista] || r.data_rota > map[r.motorista]) map[r.motorista] = r.data_rota
      }
    }
    return map
  }, [relatos, tipo])

  function handleExport() {
    const header = ['Data', 'Motorista', 'Cód.', 'Faturados', 'Devoluções', 'Limiar', 'Δ', 'Zona', 'Reincidências', 'Status Relato', 'Responsável', 'Categoria', 'Relato', 'P1', 'P2', 'P3', 'P4', 'P5']
    const linhas = [header, ...filtrados.map(m => {
      const lim  = medianLimiar
      const rel  = relatos[relatoKey(m)]
      const zona = getZonaFrota(m.devs_dia, medianLimiar)
      const p5   = Array.from({ length: 5 }, (_, i) => rel?.cinco_porques?.[i] ?? '')
      return [m.data_rota, m.nome_motorista, m.motorista, m.fat_dia, m.devs_dia, fmtLimiar(lim), fmtLimiar(m.devs_dia - lim), zona, reincMap[m.motorista] ?? 0, rel?.status ?? '', rel?.responsavel ?? '', rel?.categoria ?? '', rel?.relato ?? '', ...p5]
    })]
    baixarCSV(`gatilho-${tipo}-${periodoRef.replace(/\//g, '-')}.csv`, linhas)
  }

  return (
    <div className="space-y-4">
      {/* Stats banner — limiar mediano da frota como referência */}
      <div className="bg-[#FFF8DC] border border-[#F2C800]/40 rounded-xl px-5 py-3 flex flex-wrap gap-x-8 gap-y-1.5 text-sm">
        <span className="text-gray-600">
          Gatilho frota ({sigma}σ): <strong className="text-red-500">{fmtLimiar(medianLimiar)} dev/dia</strong>
        </span>
        <span className="text-gray-400 text-xs self-center">Referência: {periodoRef}</span>
        <button
          onClick={handleExport}
          className="ml-auto text-xs font-semibold text-[#003087] hover:text-[#0057A8] transition-colors flex items-center gap-1 self-center"
        >
          ↓ Exportar CSV
        </button>
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
          {semRelato > 0 && (
            <div className="border-l border-red-200 pl-6">
              <p className="text-xs text-red-400 font-medium uppercase tracking-wide mb-0.5">Sem relato</p>
              <p className="text-2xl font-bold text-red-600">{semRelato}</p>
            </div>
          )}
          {semRelato === 0 && estouros.length > 0 && (
            <div className="border-l border-emerald-200 pl-6">
              <p className="text-xs text-emerald-500 font-medium uppercase tracking-wide mb-0.5">Relatos</p>
              <p className="text-2xl font-bold text-emerald-600">✓ todos</p>
            </div>
          )}
        </div>
      ) : dados.length > 0 ? (
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-5 py-3 text-sm text-emerald-700 font-medium">
          Nenhum motorista excedeu o gatilho no período.
        </div>
      ) : null}

      {/* Top ofensores para causa raiz */}
      <TopOfensores dados={dados} medianLimiar={medianLimiar} />

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
        {/* Filtro por status de relato */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
          {(['todos', 'sem_relato', 'com_relato'] as FiltroRelato[]).map(f => (
            <button
              key={f}
              onClick={() => setFiltroRelato(f)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                filtroRelato === f
                  ? f === 'sem_relato'
                    ? 'bg-orange-500 text-white shadow-sm'
                    : f === 'com_relato'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-[#003087] text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {f === 'todos' ? 'Relato: todos' : f === 'sem_relato' ? '⚠ Sem relato' : '✓ Relatados'}
            </button>
          ))}
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
                <th className="text-right  py-2.5 px-4">Limiar</th>
                <th className="text-right  py-2.5 px-4">Δ Limiar</th>
                <th className="text-left   py-2.5 px-4">Uso</th>
                <th className="text-center py-2.5 px-4">Zona ABC</th>
                <th className="text-center py-2.5 px-4">Relato</th>
              </tr>
            </thead>
            <tbody>
              {filtradosVisiveis.map((m, i) => {
                const limiar      = medianLimiar
                const zona        = getZonaFrota(m.devs_dia, limiar)
                const delta       = m.devs_dia - limiar
                const isEstouro   = m.devs_dia > limiar
                const relExist    = relatos[relatoKey(m)]
                const relStatus   = relExist ? STATUS_RELATO[relExist.status] : null
                const reincCount  = reincMap[m.motorista] ?? 0
                const ultimaConc  = ultimaConclusaoMap[m.motorista]
                const reincidiu   = isEstouro && !relExist && !!ultimaConc && m.data_rota > ultimaConc
                const catInfo     = relExist?.categoria ? CATEGORIA[relExist.categoria] : null
                return (
                  <React.Fragment key={`${m.data_rota}-${m.motorista}-${i}`}>
                  <tr
                    className="border-b border-gray-50"
                    style={{ backgroundColor: isEstouro ? '#FFF5F5' : undefined }}
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
                      {reincCount > 1 && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-orange-600 mt-0.5">
                          🔁 {reincCount}x reincidente
                        </span>
                      )}
                      {tipo === 'fechado' && (
                        <button
                          onClick={e => { e.stopPropagation(); handleExpand(m) }}
                          className="mt-1 text-[9px] font-semibold text-blue-500 hover:text-blue-700 transition-colors flex items-center gap-0.5"
                        >
                          {expandedKey === `${m.motorista}|${m.data_rota}` ? '▲ fechar' : '▼ ver PDVs'}
                        </button>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-right text-gray-400 text-xs">{m.fat_dia.toLocaleString()}</td>
                    <td
                      className="py-2.5 px-4 text-right font-bold"
                      style={{ color: zona === 'critica' ? '#DC2626' : '#003087' }}
                    >
                      {m.devs_dia}
                    </td>
                    <td className="py-2.5 px-4 text-right text-gray-400 text-xs tabular-nums">
                      {fmtLimiar(limiar)}
                    </td>
                    <td
                      className={`py-2.5 px-4 text-right text-xs font-semibold ${delta > 0 ? 'text-red-500' : 'text-emerald-600'}`}
                    >
                      {delta > 0 ? '+' : ''}{fmtLimiar(delta)}
                    </td>
                    <td className="py-2.5 px-4"><UsoBarra valor={m.devs_dia} gatilho={limiar} /></td>
                    <td className="py-2.5 px-4 text-center"><ZonaBadge zona={zona} /></td>
                    <td className="py-2.5 px-4 text-center">
                      {isEstouro ? (
                        relStatus ? (
                          <RelatoCardPopover
                            relato={relExist!}
                            onEdit={() => { setEditModal(relExist!); setModalDados({ m, limiar }) }}
                          />
                        ) : (() => {
                          const dias = diasPendente(m.data_rota)
                          const sla  = corSLA(dias)
                          return (
                            <div className="flex flex-col items-center gap-0.5">
                              <button
                                onClick={() => setModalDados({ m, limiar })}
                                className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide whitespace-nowrap transition-colors"
                                style={{ backgroundColor: sla.bg, color: sla.text }}
                              >
                                ⚠ Pendente · {dias}d
                              </button>
                              {reincidiu && (
                                <span className="text-[9px] text-orange-600 font-semibold whitespace-nowrap">↩ reincidiu</span>
                              )}
                            </div>
                          )
                        })()
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                  {tipo === 'fechado' && expandedKey === `${m.motorista}|${m.data_rota}` && (
                    <tr className="border-b border-blue-100">
                      <td colSpan={9} className="px-4 py-3 bg-blue-50">
                        <p className="text-[10px] font-bold text-[#003087] uppercase tracking-wider mb-2">
                          PDVs fechados — {m.nome_motorista} · {fmtData(m.data_rota)}
                        </p>
                        <DrilldownPdvFechado pdvs={detailCache[`${m.motorista}|${m.data_rota}`]} />
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
                )
              })}
              {filtradosVisiveis.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-gray-400 text-sm">
                    {filtroRelato !== 'todos'
                      ? filtroRelato === 'sem_relato'
                        ? 'Todos os estouros já foram relatados.'
                        : 'Nenhum estouro relatado ainda.'
                      : soEstouro
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
        {filtradosVisiveis.length > 0 && (
          <div className="px-4 py-2 border-t border-gray-50 text-xs text-gray-400">
            {filtradosVisiveis.length} {soEstouro ? 'evento(s) de estouro' : 'dia(s) com devolução'}
          </div>
        )}
      </div>

      {/* Modal de relato */}
      {modalDados && (
        <RelatoModal
          variante="motorista"
          m={modalDados.m}
          limiar={modalDados.limiar}
          tipo={tipo}
          editRelato={editModal ?? undefined}
          onClose={() => { setModalDados(null); setEditModal(null) }}
        />
      )}
    </div>
  )
}

function calcLimiarFrota(dados: GatilhoMotorista[], sigma: number): number {
  const seen = new Set<string>()
  const unique = dados.filter(m => { if (seen.has(m.motorista)) return false; seen.add(m.motorista); return true })
  if (!unique.length) return 0
  const avgMedia  = unique.reduce((s, m) => s + m.media_prev,  0) / unique.length
  const avgDesvio = unique.reduce((s, m) => s + m.desvio_prev, 0) / unique.length
  return applyLimiar(avgMedia + sigma * avgDesvio)
}

export function GatilhoClient({ geral, total, fechado, relatos, initialTab }: Props) {
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

  // Gatilho de frota para Dev. Total: média das médias individuais (1 entrada por motorista)
  const medianLimiarTotal   = useMemo(() => calcLimiarFrota(total,   sigma), [total,   sigma])

  // Gatilho de frota para PDV Fechado
  const medianLimiarFechado = useMemo(() => calcLimiarFrota(fechado, sigma), [fechado, sigma])

  const periodoRef = geral[0]?.periodo_ref ?? total[0]?.periodo_ref ?? '—'

  // KPIs
  const diasCrit       = geral.filter(d => d.pct_dev > gatilhoGeral).length
  const totalEventos   = total.filter(m => m.devs_dia > medianLimiarTotal).length
  const fechadoEventos = fechado.filter(m => m.devs_dia > medianLimiarFechado).length

  // Filtros para aba Dev. Total
  const totalFiltrado = useMemo(() => {
    const q = busca.toLowerCase()
    const r = busca
      ? total.filter(m => m.nome_motorista.toLowerCase().includes(q) || m.motorista.includes(q))
      : total
    return soEstouro ? r.filter(m => m.devs_dia > medianLimiarTotal) : r
  }, [total, busca, soEstouro, medianLimiarTotal])

  // Filtros para aba PDV Fechado
  const fechadoFiltrado = useMemo(() => {
    const q = busca.toLowerCase()
    const r = busca
      ? fechado.filter(m => m.nome_motorista.toLowerCase().includes(q) || m.motorista.includes(q))
      : fechado
    return soEstouro ? r.filter(m => m.devs_dia > medianLimiarFechado) : r
  }, [fechado, busca, soEstouro, medianLimiarFechado])

  // Alerta precoce — motoristas em 70–99% do gatilho numérico
  const totalQuase = useMemo(() =>
    [...new Set(
      total
        .filter(m => {
          const p = medianLimiarTotal > 0 ? (m.devs_dia / medianLimiarTotal) * 100 : 0
          return p >= 70 && p < 100
        })
        .map(m => m.nome_motorista)
    )].slice(0, 6),
  [total, medianLimiarTotal])

  const fechadoQuase = useMemo(() =>
    [...new Set(
      fechado
        .filter(m => {
          const p = medianLimiarFechado > 0 ? (m.devs_dia / medianLimiarFechado) * 100 : 0
          return p >= 70 && p < 100
        })
        .map(m => m.nome_motorista)
    )].slice(0, 6),
  [fechado, medianLimiarFechado])

  // ── Relato geral — contagem para KPI ─────────────────────────────────────
  const semRelatoGeral = geral.filter(d => d.pct_dev > gatilhoGeral && !relatos[`|${d.data_rota}|geral`]).length

  // ── Reincidentes ─────────────────────────────────────────────────────────
  const reinciTotalCount = useMemo(() => {
    const map: Record<string, number> = {}
    for (const m of total) {
      if (m.devs_dia > medianLimiarTotal) map[m.motorista] = (map[m.motorista] ?? 0) + 1
    }
    return Object.values(map).filter(c => c > 1).length
  }, [total, medianLimiarTotal])

  const reinciFechadoCount = useMemo(() => {
    const map: Record<string, number> = {}
    for (const m of fechado) {
      if (m.devs_dia > medianLimiarFechado) map[m.motorista] = (map[m.motorista] ?? 0) + 1
    }
    return Object.values(map).filter(c => c > 1).length
  }, [fechado, medianLimiarFechado])

  // ── Relatos atrasados > 3d ────────────────────────────────────────────────
  const atrasados3d = useMemo(() => {
    let count = 0
    for (const d of geral) {
      if (d.pct_dev > gatilhoGeral && !relatos[`|${d.data_rota}|geral`] && diasPendente(d.data_rota) > 3) count++
    }
    for (const m of total) {
      if (m.devs_dia > medianLimiarTotal && !relatos[`${m.motorista}|${m.data_rota}|total`] && diasPendente(m.data_rota) > 3) count++
    }
    for (const m of fechado) {
      if (m.devs_dia > medianLimiarFechado && !relatos[`${m.motorista}|${m.data_rota}|fechado`] && diasPendente(m.data_rota) > 3) count++
    }
    return count
  }, [geral, total, fechado, relatos, gatilhoGeral, medianLimiarTotal, medianLimiarFechado])

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
          sub={diasCrit > 0 ? (semRelatoGeral > 0 ? `${semRelatoGeral} sem relato` : '✓ todos relatados') : undefined}
          alerta={diasCrit > 0}
        />
        <KpiCard
          label="Gatilho Dev. Total (frota)"
          value={`${fmtLimiar(medianLimiarTotal)} dev/dia`}
          sub={`${totalEventos} estouro(s) · ${totalEventos - total.filter(m => relatos[`${m.motorista}|${m.data_rota}|total`] && m.devs_dia > medianLimiarTotal).length} sem relato`}
          alerta={totalEventos > 0}
        />
        <KpiCard
          label="Gatilho PDV Fechado (frota)"
          value={`${fmtLimiar(medianLimiarFechado)} dev/dia`}
          sub={`${fechadoEventos} estouro(s) · ${fechadoEventos - fechado.filter(m => relatos[`${m.motorista}|${m.data_rota}|fechado`] && m.devs_dia > medianLimiarFechado).length} sem relato`}
          alerta={fechadoEventos > 0}
        />
      </div>

      {/* KPI row 2 — operacional */}
      <div className="grid grid-cols-2 gap-3">
        <KpiCard
          label="Motoristas reincidentes"
          value={`${Math.max(reinciTotalCount, reinciFechadoCount)}`}
          sub={reinciTotalCount > 0 || reinciFechadoCount > 0
            ? `Total: ${reinciTotalCount} · Fechado: ${reinciFechadoCount}`
            : '✓ Nenhum reincidente'}
          alerta={reinciTotalCount > 0 || reinciFechadoCount > 0}
        />
        <KpiCard
          label="Relatos atrasados > 3d"
          value={`${atrasados3d}`}
          sub={atrasados3d > 0 ? 'Estouro pendente há mais de 3 dias' : '✓ Nenhum atrasado'}
          alerta={atrasados3d > 0}
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

      {tab === 'geral' && (
        <TabGeral
          dados={geral}
          gatilho={gatilhoGeral}
          media={mediaGeral}
          desvio={desvioGeral}
          sigma={sigma}
          periodoRef={periodoRef}
          relatos={relatos}
        />
      )}
      {tab === 'total' && (
        <TabMotoristas
          dados={total}       filtrados={totalFiltrado}   quase={totalQuase}
          medianLimiar={medianLimiarTotal}
          sigma={sigma}       periodoRef={periodoRef}
          busca={busca}       soEstouro={soEstouro}
          onBusca={setBusca}  onSoEstouro={setSoEstouro}
          tipo="total"        relatos={relatos}
        />
      )}
      {tab === 'fechado' && (
        <TabMotoristas
          dados={fechado}      filtrados={fechadoFiltrado}  quase={fechadoQuase}
          medianLimiar={medianLimiarFechado}
          sigma={sigma}        periodoRef={periodoRef}
          busca={busca}        soEstouro={soEstouro}
          onBusca={setBusca}   onSoEstouro={setSoEstouro}
          tipo="fechado"       relatos={relatos}
        />
      )}
    </div>
  )
}
