/**
 * Mapeamentos de normalização usados na importação de planilhas.
 * Centralizado aqui para evitar duplicação entre rotas de API.
 */

/** Normaliza o campo `status` da planilha para o valor salvo no banco. */
export const STATUS_MAP: Record<string, string> = {
  // Português (valores reais da planilha)
  'CONCLUIDO':       'entregue',
  'DEVOLVIDO':       'devolvido',
  'ENTREGA PARCIAL': 'devolvido_parcial',
  'REAGENDADO':      'reagendado',
  'NÃO INICIADA':    'tratativa_aberta',
  'EM TRATAMENTO':   'em_tratamento',
  'INICIADA':        'tratativa_aberta',
  'A CAMINHO':       'tratativa_aberta',
  // Inglês (fallback para arquivos legados)
  'CONCLUDED':            'entregue',
  'DEFINITELY_RETURNED':  'devolvido',
  'PARTIAL_DELIVERY':     'devolvido_parcial',
  'RESCHEDULED':          'reagendado',
  'NOT_STARTED':          'tratativa_aberta',
  'IN_TREATMENT':         'em_tratamento',
  'DELIVERY_STARTED':     'tratativa_aberta',
  'ON_THE_WAY':           'tratativa_aberta',
  'WAITING_MODULATION':   'em_tratamento',
}

/** Normaliza o campo `last_reason_waiting_modulation` para label e classificação. */
export const MOTIVO_MAP: Record<string, { label: string; classificacao: string }> = {

  // ── PDV FECHADO ────────────────────────────────────────────────────────────
  'closed POS':                            { label: 'PDV fechado',                  classificacao: 'Mercado'   },
  'Closed POS':                            { label: 'PDV fechado',                  classificacao: 'Mercado'   },
  'POC closed':                            { label: 'PDV fechado',                  classificacao: 'Mercado'   },
  'POC closed after working hours':        { label: 'PDV fechado fora do horário',  classificacao: 'Mercado'   },

  // ── SEM DINHEIRO ───────────────────────────────────────────────────────────
  'No money':                              { label: 'Sem dinheiro',                 classificacao: 'Mercado'   },
  'No cash':                               { label: 'Sem dinheiro',                 classificacao: 'Mercado'   },

  // ── SEM VASILHAMES ─────────────────────────────────────────────────────────
  'Without container':                     { label: 'Sem vasilhames',               classificacao: 'Logístico' },

  // ── NÃO FEZ PEDIDO ─────────────────────────────────────────────────────────
  'Did not place an order':                { label: 'Não fez pedido',               classificacao: 'Vendas'    },
  'Did not order':                         { label: 'Não fez pedido',               classificacao: 'Vendas'    },

  // ── PEDIDO ERRADO / DUPLICADO ──────────────────────────────────────────────
  'Wrong/Duplicate order':                 { label: 'Pedido errado/duplicado',      classificacao: 'Vendas'    },
  'Wrong/Duplicate Order':                 { label: 'Pedido errado/duplicado',      classificacao: 'Vendas'    },
  'Wrong order':                           { label: 'Pedido errado/duplicado',      classificacao: 'Vendas'    },

  // ── DIFÍCIL ACESSO ─────────────────────────────────────────────────────────
  'Difficult access':                      { label: 'Difícil acesso',               classificacao: 'Logístico' },
  'Difficult Access to POC':               { label: 'Difícil acesso',               classificacao: 'Logístico' },
  'Cowless':                               { label: 'Difícil acesso',               classificacao: 'Logístico' },

  // ── TEMPO INSUFICIENTE ─────────────────────────────────────────────────────
  'Not enough time':                       { label: 'Tempo insuficiente',           classificacao: 'Logístico' },
  'Insufficient time':                     { label: 'Tempo insuficiente',           classificacao: 'Logístico' },

  // ── PRAZO / HORÁRIO / DIA DE ENTREGA ──────────────────────────────────────
  'Delivery window':                       { label: 'Prazo de entrega',             classificacao: 'Logístico' },
  'Delivery time':                         { label: 'Horário de entrega',           classificacao: 'Logístico' },
  'Delivery data':                         { label: 'Dia de entrega',               classificacao: 'Logístico' },

  // ── ENDEREÇO NÃO ENCONTRADO ────────────────────────────────────────────────
  'Address not found':                     { label: 'Endereço não encontrado',      classificacao: 'Logístico' },
  'Wrong address':                         { label: 'Endereço não encontrado',      classificacao: 'Logístico' },

  // ── FORMA DE PAGAMENTO ─────────────────────────────────────────────────────
  'Payment method':                        { label: 'Forma de pagamento',           classificacao: 'Vendas'    },

  // ── CLIENTE CANCELOU ───────────────────────────────────────────────────────
  'Loading error':                         { label: 'Cliente cancelou',             classificacao: 'Mercado'   },

  // ── CLIENTE NÃO AUTORIZOU ──────────────────────────────────────────────────
  'Customer did not authorize collection': { label: 'Cliente não autorizou coleta', classificacao: 'Mercado'   },

  // ── PROBLEMA DE SEGURANÇA ──────────────────────────────────────────────────
  'Security / Safety issues':              { label: 'Problema de segurança',        classificacao: 'Mercado'   },

  // ── QUALIDADE DO PRODUTO ───────────────────────────────────────────────────
  'Product Quality':                       { label: 'Qualidade do produto',         classificacao: 'Logístico' },

  // ── CAMINHÃO QUEBRADO ──────────────────────────────────────────────────────
  'Broken truck':                          { label: 'Caminhão quebrado',            classificacao: 'Logístico' },

  // ── RECIPIENTE CHEIO ───────────────────────────────────────────────────────
  'Full container':                        { label: 'Recipiente cheio',             classificacao: 'Logístico' },

  // ── CLIENTE DE RISCO ───────────────────────────────────────────────────────
  'Risk/Claim Client':                     { label: 'Cliente de risco',             classificacao: 'Mercado'   },

  // ── EMPRÉSTIMO NÃO ENCONTRADO ──────────────────────────────────────────────
  'Loan not found':                        { label: 'Empréstimo não encontrado',    classificacao: 'Logístico' },

  // ── QUANTIDADE INSUFICIENTE ────────────────────────────────────────────────
  'Insufficient quantity':                 { label: 'Quantidade insuficiente',      classificacao: 'Logístico' },
}
