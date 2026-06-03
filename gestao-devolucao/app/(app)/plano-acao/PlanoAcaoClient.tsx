'use client'

import { useState, useTransition } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { AcaoDrawer } from './AcaoDrawer'
import { excluirAcao } from './actions'
import type { PlanoAcao } from '@/types'

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
    startTransition(async () => { await excluirAcao(id) })
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

      <AcaoDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        acao={acaoEditando}
      />
    </>
  )
}
