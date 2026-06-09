export type Role = 'admin' | 'coordenador' | 'supervisor' | 'cme' | 'consulta' | 'vendas'
export type ClassificacaoMotivo = 'Mercado' | 'Logístico' | 'Vendas'
export type StatusFinal = 'entregue' | 'devolvido' | 'devolvido_parcial' | 'reagendado' | 'tratativa_aberta'
export type StatusPlano = 'aberto' | 'em_andamento' | 'concluido' | 'cancelado'
export type PrioridadePlano = 'critica' | 'alta' | 'media' | 'monitoramento'

export interface Perfil {
  id: string
  user_id: string
  nome: string
  role: Role
  criado_em: string
}

export interface Devolucao {
  id: string
  importacao_id: string
  data_rota: string
  cdd: string
  motorista: string
  rota: string
  placa: string
  cliente: string
  codigo_pdv: string
  rn: string
  gv: string
  supervisor: string
  vendas: string
  motivo: string
  classificacao_motivo: ClassificacaoMotivo
  pdvs_faturados: number
  pdvs_devolvidos: number
  volume_faturado_hl: number
  volume_devolvido_hl: number
  alertas_apontados: number
  devolucoes_revertidas: number
  repasses_programados: number
  repasses_informados: number
  repasses_realizados: number
  horario_apontamento: string
  horario_atendimento_cme: string
  horario_finalizacao: string
  status_final: StatusFinal
  dentro_raio: boolean
  aderencia_raio: number
  devolucao_antes_horario: boolean
  evidencia: string
  recorrencia_pdv: number
  qtd_devolucoes_anteriores: number
  janela_entrega: string
  responsavel_acionado: string
  canal_contato: string
  resultado_contato: string
  criado_em: string
}

export interface IndicadorDiario {
  id: string
  data_ref: string
  cdd: string
  devolucao_pdv_pct: number
  devolucao_hl_pct: number
  reversao_pct: number
  repasses_apontados_pct: number
  repasses_efetivos_pct: number
  tempo_medio_cme: string
  tempo_medio_tratativa: string
  devolucoes_apontadas_vs_total_pct: number
  aderencia_raio_pct: number
  devolucao_antes_horario_pct: number
  calculado_em: string
}

export interface GatilhoContexto {
  motorista:     string
  data_rota:     string
  tipo:          'total' | 'fechado' | 'geral'
  devs_dia:      number
  limiar:        number
  relato:        string
  responsavel:   string | null
  cinco_porques?: string[]
  categoria?:    string
}

export interface PlanoAcao {
  id: string
  descricao: string
  responsavel: string
  prazo: string
  status: StatusPlano
  prioridade: PrioridadePlano
  indicador_impactado: string
  evidencia: string
  comentarios: string
  criado_por: string
  criado_em: string
  atualizado_em: string
  gatilho_contexto: GatilhoContexto | null
}

export interface Meta {
  id: string
  indicador: string
  valor_meta: number
  cdd: string
  vigencia_inicio: string
  vigencia_fim: string
}

export interface ResultadoIndicador {
  valor: number | null
  erro?: string
}
