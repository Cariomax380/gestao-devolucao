'use client'

import { useState, useEffect, useRef } from 'react'

interface Motorista {
  motorista: string
  nome: string
  fat: number
  dev: number
  fora_raio: number
  total: number
  pct_dev: number
  pct_fora: number
  score: number
}

interface PdvForaRaio {
  codigo_pdv: string
  cliente: string
  motivo: string
  qtd: number
}

interface Props {
  motoristas: Motorista[]
  pdvsPorMotorista: Record<string, PdvForaRaio[]>
  maxPctDev: number
  maxPctFora: number
}

function situacao(score: number) {
  if (score >  1.0) return { label: 'Crítico',    cor: '#EF4444' }
  if (score >  0.0) return { label: 'Atenção',    cor: '#D97706' }
  if (score > -1.0) return { label: 'Regular',    cor: '#0057A8' }
  return                   { label: 'Referência', cor: '#10B981' }
}

export function TabelaOfensores({ motoristas, pdvsPorMotorista, maxPctDev, maxPctFora }: Props) {
  const [aberto, setAberto] = useState<string | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const pdvsAtivos = aberto ? (pdvsPorMotorista[aberto] ?? []) : []
  const nomeAtivo  = aberto ? motoristas.find(m => m.motorista === aberto)?.nome ?? '' : ''

  // Fecha ao clicar fora do painel
  useEffect(() => {
    if (!aberto) return
    function onMouseDown(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setAberto(null)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [aberto])

  function toggleRow(motorista: string) {
    const pdvs = pdvsPorMotorista[motorista]
    if (!pdvs?.length) return
    setAberto(prev => (prev === motorista ? null : motorista))
  }

  return (
    <div className="relative">
      {/* Tabela */}
      <div className="overflow-y-auto max-h-[28rem]">
        {/* Header */}
        <div
          className="grid gap-3 pb-2 mb-1 border-b border-gray-100 text-[10px] font-medium text-gray-400 uppercase tracking-wide sticky top-0 bg-white z-10"
          style={{ gridTemplateColumns: '20px 1fr 100px 100px 40px 40px 90px' }}
        >
          <span>#</span>
          <span>Motorista</span>
          <span className="text-center">% Dev PDV</span>
          <span className="text-center">% Fora Raio</span>
          <span className="text-right">Fat.</span>
          <span className="text-right">Dev.</span>
          <span className="text-center">Situação</span>
        </div>

        {motoristas.map((m, i) => {
          const p     = situacao(m.score)
          const pdvs  = pdvsPorMotorista[m.motorista] ?? []
          const ativo = aberto === m.motorista
          const temPdvs = pdvs.length > 0

          return (
            <div
              key={m.motorista}
              onClick={() => toggleRow(m.motorista)}
              className={`grid gap-3 py-2.5 border-b border-gray-50 items-center transition-colors ${
                ativo
                  ? 'bg-[#FFF8DC]'
                  : temPdvs
                  ? 'hover:bg-[#FFF8DC] cursor-pointer'
                  : 'cursor-default'
              }`}
              style={{ gridTemplateColumns: '20px 1fr 100px 100px 40px 40px 90px' }}
            >
              <span className="text-[#D4A800] text-xs font-bold text-right">{i + 1}</span>

              {/* Nome + badge */}
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-xs text-gray-700 font-medium truncate">{m.nome}</span>
                {pdvs.length > 0 && (
                  <span className={`shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full transition-colors ${
                    ativo
                      ? 'bg-[#7c3aed] text-white'
                      : 'bg-[#7c3aed]/10 text-[#7c3aed]'
                  }`}>
                    {pdvs.length} PDV{pdvs.length > 1 ? 's' : ''}
                  </span>
                )}
              </div>

              {/* PDV % bar */}
              <div className="flex items-center gap-1.5">
                <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                  <div className="h-full rounded-full bg-[#F2C800]"
                    style={{ width: `${(m.pct_dev / maxPctDev) * 100}%` }} />
                </div>
                <span className="text-[#D4A800] text-[10px] font-bold w-8 text-right shrink-0">{m.pct_dev.toFixed(1)}%</span>
              </div>

              {/* Raio % bar */}
              <div className="flex items-center gap-1.5">
                <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                  <div className="h-full rounded-full bg-[#7c3aed]"
                    style={{ width: `${(m.pct_fora / maxPctFora) * 100}%` }} />
                </div>
                <span className="text-[#7c3aed] text-[10px] font-bold w-8 text-right shrink-0">{m.pct_fora.toFixed(1)}%</span>
              </div>

              <span className="text-[10px] text-gray-500 text-right">{m.fat}</span>
              <span className="text-[10px] text-gray-600 text-right font-semibold">{m.dev}</span>
              <div className="flex justify-center">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                  style={{ backgroundColor: p.cor + '15', color: p.cor }}>{p.label}</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Painel lateral fixo — aparece à direita da tabela */}
      {aberto && pdvsAtivos.length > 0 && (
        <div
          ref={panelRef}
          className="fixed top-1/2 right-6 -translate-y-1/2 z-[9999] w-80 bg-white border border-gray-200 rounded-xl shadow-2xl p-4"
        >
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[#003087] truncate">{nomeAtivo}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">
                {pdvsAtivos.length} PDV{pdvsAtivos.length > 1 ? 's' : ''} com devolução fora do raio
              </p>
            </div>
            <button
              onClick={() => setAberto(null)}
              className="shrink-0 text-gray-400 hover:text-gray-600 text-sm leading-none w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100"
            >
              ✕
            </button>
          </div>

          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1 mt-3">
            {pdvsAtivos.map((pdv) => (
              <div key={pdv.codigo_pdv} className="bg-[#7c3aed]/5 border border-[#7c3aed]/15 rounded-lg px-3 py-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-700 truncate">{pdv.cliente || '—'}</p>
                    <p className="text-[10px] text-gray-400 font-mono">{pdv.codigo_pdv}</p>
                  </div>
                  {pdv.qtd > 1 && (
                    <span className="text-[10px] font-bold text-[#7c3aed] shrink-0 bg-[#7c3aed]/10 px-1.5 py-0.5 rounded-full">
                      {pdv.qtd}×
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-gray-500 mt-1 truncate">{pdv.motivo || '—'}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
