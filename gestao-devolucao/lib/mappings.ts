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
}

/** Normaliza o campo `last_reason_waiting_modulation` para label e classificação. */
export const MOTIVO_MAP: Record<string, { label: string; classificacao: string }> = {
  'closed POS':                            { label: 'PDV fechado',                  classificacao: 'Mercado'   },
  'No money':                              { label: 'Sem dinheiro',                 classificacao: 'Mercado'   },
  'Customer did not authorize collection': { label: 'Cliente não autorizou coleta', classificacao: 'Mercado'   },
  'Did not place an order':                { label: 'Não fez pedido',               classificacao: 'Vendas'    },
  'Wrong/Duplicate order':                 { label: 'Pedido errado/duplicado',      classificacao: 'Vendas'    },
  'Payment method':                        { label: 'Forma de pagamento',           classificacao: 'Vendas'    },
  'Loading error':                         { label: 'Erro de carregamento',         classificacao: 'Logístico' },
  'Without container':                     { label: 'Sem vasilhame',                classificacao: 'Logístico' },
  'Delivery time':                         { label: 'Fora do horário',              classificacao: 'Logístico' },
  'Difficult access':                      { label: 'Acesso difícil',               classificacao: 'Logístico' },
  'Not enough time':                       { label: 'Sem tempo na rota',            classificacao: 'Logístico' },
  'Address not found':                     { label: 'Endereço não encontrado',      classificacao: 'Logístico' },
}
