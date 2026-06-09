'use client'

import { useState, useTransition } from 'react'
import { Plus, Pencil, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { AcaoDrawer } from './AcaoDrawer'
import { excluirAcao } from './actions'
import type { PlanoAcao, GatilhoContexto } from '@/types'

const TIPO_LABEL: Record<string, string> = {
  total:   'Dev. Total',
  fechado: 'PDV Fechado',
  geral:   'Geral (frota)',
}

const CAT_ESTILO: Record<string, { bg: string; text: string }> = {
  operacional: { bg: '#DBEAFE', text: '#1D4ED8' },
  comercial:   { bg: '#EDE9FE', text: '#7C3AED' },
  externo:     { bg: '#D1FAE5', text: '#059669' },
  sistemico:   { bg: '#FEE2E2', text: '#DC2626' },
}

const CAT_LABEL: Record<string, string> = {
  operacional: 'Operacional',
  comercial:   'Comercial',
  externo:     'Externo',
  sistemico:   'Sistêmico',
}

function fmtData(d: string) {
  const p = d.split('-')
  return p.length >= 3 ? `${p[2]}/${p[1]}/${p[0]}` : d
}

function GatilhoContextoBlock({ ctx }: { ctx: GatilhoContexto }) {
  const [expand5p, setExpand5p] = useState(false)
  const filled5p = ctx.cinco_porques?.filter(p => p.trim()) ?? []
  const catEstilo = ctx.categoria ? CAT_ESTILO[ctx.categoria] : null

  return (
    <div className="mt-3 border border-[#003087]/12 rounded-lg bg-[#003087]/[0.025] overflow-hidden">
      {/* Cabeçalho */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[#003087]/10 flex-wrap">
        <span className="text-[10px] font-bold text-[#003087] bg-[#003087]/10 px-2 py-0.5 rounded-full uppercase tracking-wide">
          🎯 Origem Gatilho
        </span>
        <span className="text-xs text-gray-500">{TIPO_LABEL[ctx.tipo]}</span>
        <span className="text-gray-300 text-xs">·</span>
        <span className="text-xs text-gray-500">{fmtData(ctx.data_rota)}</span>
        {ctx.motorista && (
          <>
            <span className="text-gray-300 text-xs">·</span>
            <span className="text-xs font-medium text-gray-600">{ctx.motorista}</span>
          </>
        )}
        {catEstilo && (
          <span
            className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide ml-auto"
            style={{ backgroundColor: catEstilo.bg, color: catEstilo.text }}
          >
            {CAT_LABEL[ctx.categoria!]}
          </span>
        )}
      </div>

      {/* Corpo */}
      <div className="px-3 py-2.5 space-y-2">
        {/* Desvio */}
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span>
            Devoluções: <strong className="text-red-600">{ctx.devs_dia}</strong>
          </span>
          <span className="text-gray-300">|</span>
          <span>
            Limiar: <strong className="text-gray-700">{ctx.limiar}</strong>
          </span>
          <span className="text-gray-300">|</span>
          <span>
            Δ: <strong className="text-red-600">+{(ctx.devs_dia - ctx.limiar).toFixed(1)}</strong>
          </span>
        </div>

        {/* Responsável */}
        {ctx.responsavel && (
          <p className="text-xs text-gray-600">
            <span className="font-medium text-gray-500">Responsável: </span>{ctx.responsavel}
          </p>
        )}

        {/* Relato */}
        <p className="text-xs text-gray-700 leading-relaxed">
          <span className="font-medium text-gray-500">Relato: </span>{ctx.relato}
        </p>

        {/* 5 Porquês */}
        {filled5p.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setExpand5p(v => !v)}
              className="flex items-center gap-1.5 text-xs font-semibold text-[#003087] hover:text-[#001a5c] transition-colors"
            >
              {expand5p ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              5 Porquês ({filled5p.length} {filled5p.length === 1 ? 'causa' : 'causas'})
            </button>
            {expand5p && (
              <ol className="mt-2 space-y-1.5 border-l-2 border-[#003087]/20 pl-3">
                {filled5p.map((p, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="w-4 h-4 rounded-full bg-[#003087]/10 text-[#003087] text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <p className="text-xs text-gray-700 leading-relaxed">{p}</p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

const PRIORIDADE_COR: Record<string, string> = {
  critica:       '#EF4444',
  alta:          '#D97706',
  media:         '#0057A8',
  monitoramento: '#6B7280',
}

const STATUS_COR: Record<string, string> = {
  aberto:        '#D97706',
  em_andamento:  '#0057A8',
  concluido:     '#10B981',
  cancelado:     '#6B7280',
}

const STATUS_LABEL: Record<string, string> = {
  aberto:        'Aberto',
  em_andamento:  'Em andamento',
  concluido:     'Concluído',
  cancelado:     'Cancelado',
}

const PRIORIDADE_LABEL: Record<string, string> = {
  critica:       'Crítica',
  alta:          'Alta',
  media:         'Média',
  monitoramento: 'Monitoramento',
}

interface Props { acoes: PlanoAcao[] }

export function PlanoAcaoClient({ acoes }: Props) {
  const [drawerOpen, setDrawerOpen]             = useState(false)
  const [acaoEditando, setAcaoEditando]         = useState<PlanoAcao | null>(null)
  const [isPending, startTransition]            = useTransition()
  const [filtroStatus, setFiltroStatus]         = useState<string | null>(null)
  const [filtroPrioridade, setFiltroPrioridade] = useState<string | null>(null)

  const porStatus = {
    aberto:       acoes.filter(a => a.status === 'aberto'),
    em_andamento: acoes.filter(a => a.status === 'em_andamento'),
    concluido:    acoes.filter(a => a.status === 'concluido'),
    cancelado:    acoes.filter(a => a.status === 'cancelado'),
  }

  const isVencida = (a: PlanoAcao) =>
    !!(a.prazo && new Date(a.prazo) < new Date() && a.status !== 'concluido' && a.status !== 'cancelado')

  const vencidas = acoes.filter(isVencida)

  const acoesFiltradas = acoes.filter(a => {
    if (filtroStatus     && a.status     !== filtroStatus)     return false
    if (filtroPrioridade && a.prioridade !== filtroPrioridade) return false
    return true
  })

  function abrirNova()             { setAcaoEditando(null);  setDrawerOpen(true) }
  function abrirEdicao(a: PlanoAcao) { setAcaoEditando(a);  setDrawerOpen(true) }
  function handleExcluir(id: string) {
    if (!confirm('Excluir esta ação?')) return
    startTransition(async () => {
      const res = await excluirAcao(id)
      if (res && 'error' in res) alert(`Erro ao excluir: ${res.error}`)
    })
  }

  return (
    <>
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-semibold text-lg text-[#003087]">Plano de Ação</h1>
            <p className="text-gray-500 text-sm mt-0.5">{acoes.length} ações · {porStatus.aberto.length} abertas</p>
          </div>
          <button
            onClick={abrirNova}
            className="flex items-center gap-2 bg-[#F2C800] hover:bg-[#D4A800] text-[#003087] text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors"
          >
            <Plus size={16} />
            Nova ação
          </button>
        </div>

        {/* Resumo por status */}
        <div className="grid grid-cols-4 gap-3">
          {Object.entries(porStatus).map(([status, items]) => (
            <div key={status} className="bg-white border border-gray-100 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: STATUS_COR[status] }} />
                <span className="text-gray-500 text-xs font-medium">{STATUS_LABEL[status]}</span>
              </div>
              <p className="text-2xl font-bold text-[#003087]">{items.length}</p>
            </div>
          ))}
        </div>

        {/* Alertas vencidos */}
        {vencidas.length > 0 && (
          <div className="bg-[#EF4444]/5 border border-[#EF4444]/20 rounded-xl p-4 flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-[#EF4444] animate-pulse shrink-0" />
            <p className="text-[#EF4444] text-sm">
              <strong>{vencidas.length} ações vencidas</strong> sem conclusão — revisão necessária.
            </p>
          </div>
        )}

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-gray-400 text-xs font-medium">Filtrar:</span>

          {Object.entries(STATUS_LABEL).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFiltroStatus(filtroStatus === key ? null : key)}
              className="text-xs px-3 py-1 rounded-full border transition-all"
              style={filtroStatus === key
                ? { backgroundColor: STATUS_COR[key] + '15', color: STATUS_COR[key], borderColor: STATUS_COR[key] + '50' }
                : { backgroundColor: 'transparent', color: '#6B7280', borderColor: '#E5E7EB' }
              }
            >
              {label} ({porStatus[key as keyof typeof porStatus]?.length ?? 0})
            </button>
          ))}

          <span className="text-gray-300 text-xs mx-1">|</span>

          {Object.entries(PRIORIDADE_LABEL).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFiltroPrioridade(filtroPrioridade === key ? null : key)}
              className="text-xs px-3 py-1 rounded-full border transition-all"
              style={filtroPrioridade === key
                ? { backgroundColor: PRIORIDADE_COR[key] + '15', color: PRIORIDADE_COR[key], borderColor: PRIORIDADE_COR[key] + '50' }
                : { backgroundColor: 'transparent', color: '#6B7280', borderColor: '#E5E7EB' }
              }
            >
              {label}
            </button>
          ))}

          {(filtroStatus || filtroPrioridade) && (
            <button
              onClick={() => { setFiltroStatus(null); setFiltroPrioridade(null) }}
              className="text-xs text-gray-400 hover:text-gray-700 underline ml-1 transition-colors"
            >
              limpar
            </button>
          )}

          {(filtroStatus || filtroPrioridade) && (
            <span className="text-gray-400 text-xs ml-auto">{acoesFiltradas.length} de {acoes.length}</span>
          )}
        </div>

        {/* Lista de ações */}
        <div className="space-y-3 max-h-[36rem] overflow-y-auto pr-1">
          {acoesFiltradas.map((acao) => {
            const vencida = isVencida(acao)
            return (
              <div
                key={acao.id}
                className="bg-white border border-gray-100 rounded-xl p-5 hover:border-[#F2C800]/40 transition-all group"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                        style={{ backgroundColor: PRIORIDADE_COR[acao.prioridade] + '15', color: PRIORIDADE_COR[acao.prioridade] }}>
                        {PRIORIDADE_LABEL[acao.prioridade]}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{ backgroundColor: STATUS_COR[acao.status] + '12', color: STATUS_COR[acao.status] }}>
                        {STATUS_LABEL[acao.status]}
                      </span>
                      {acao.indicador_impactado && (
                        <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full border border-gray-100">
                          {acao.indicador_impactado}
                        </span>
                      )}
                      {vencida && (
                        <span className="text-xs text-[#EF4444] bg-[#EF4444]/8 px-2 py-0.5 rounded-full">Vencida</span>
                      )}
                    </div>
                    <p className="text-gray-700 text-sm leading-relaxed">{acao.descricao}</p>
                    {acao.gatilho_contexto && (
                      <GatilhoContextoBlock ctx={acao.gatilho_contexto} />
                    )}
                    <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
                      {acao.responsavel && <span>{acao.responsavel}</span>}
                      {acao.prazo && (
                        <span className={vencida ? 'text-[#EF4444]' : ''}>
                          {new Date(acao.prazo + 'T12:00:00').toLocaleDateString('pt-BR')}
                        </span>
                      )}
                      <span>{new Date(acao.criado_em).toLocaleDateString('pt-BR')}</span>
                    </div>
                    {acao.comentarios && (
                      <p className="text-gray-400 text-xs mt-2 italic">{acao.comentarios}</p>
                    )}
                  </div>

                  <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button
                      onClick={() => abrirEdicao(acao)}
                      className="p-2 rounded-lg text-gray-400 hover:text-[#003087] hover:bg-[#003087]/8 transition-all"
                      title="Editar"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => handleExcluir(acao.id)}
                      disabled={isPending}
                      className="p-2 rounded-lg text-gray-400 hover:text-[#EF4444] hover:bg-[#EF4444]/8 transition-all disabled:opacity-50"
                      title="Excluir"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}

          {acoesFiltradas.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              {acoes.length === 0
                ? <><p className="text-lg text-gray-500">Nenhuma ação cadastrada.</p><p className="text-sm mt-1">Clique em "Nova ação" para começar.</p></>
                : <p className="text-lg text-gray-500">Nenhuma ação para o filtro selecionado.</p>
              }
            </div>
          )}
        </div>
      </div>

      {/* key força re-mount ao trocar entre editar/novo — sem isso defaultValue fica com dados antigos */}
      <AcaoDrawer
        key={acaoEditando?.id ?? 'new'}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        acao={acaoEditando}
      />
    </>
  )
}
