/**
 * calcular-reversao.ts
 * Memória de cálculo do indicador % de Reversão.
 *
 * Fórmula:
 *   % Reversão = QTD REV / (QTD REV + QTD DEV)
 *
 * Flags por registro:
 *   flag_reversao  = 1  se o registro é uma reversão   (pdv_repasse > 0)
 *   flag_devolucao = 1  se é devolução não revertida   (pdvs_devolvidos > 0 && pdv_repasse = 0)
 *
 * NÃO confundir com % Devolução = QTD DEV / QTD ENTREGA.
 */

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type Agrupamento = 'geral' | 'motorista' | 'cod_pdv' | 'data' | 'motivo' | 'rota'

/** Registro normalizado recebido pelo server component (motorista já resolvido). */
export interface RegistroReversao {
  status_final:    string | null // 'devolvido' | 'repasse' | 'tratativa_aberta' | 'entregue'
  pdvs_devolvidos: number
  pdv_repasse:     number
  motorista_nome:  string        // nome resolvido, nunca null
  codigo_pdv:      string | null
  data_rota:       string | null // formato ISO 'YYYY-MM-DD' ou null
  motivo:          string | null
  rota:            string | null
}

export interface ResultadoReversao {
  grupo:                        string
  qtd_rev:                      number
  qtd_dev:                      number
  total_oportunidades:          number
  percentual_reversao:          number  // 0–1
  percentual_reversao_formatado:string  // ex: "75,00%"
}

// ─── Helpers internos ─────────────────────────────────────────────────────────

function formatarData(iso: string | null): string {
  if (!iso) return 'Sem data'
  try {
    const d = new Date(iso + 'T12:00:00')
    if (isNaN(d.getTime())) return 'Data inválida'
    return d.toLocaleDateString('pt-BR')
  } catch {
    return 'Data inválida'
  }
}

function getChave(r: RegistroReversao, agrupamento: Agrupamento): string {
  switch (agrupamento) {
    case 'geral':
      return 'Geral'
    case 'motorista':
      return r.motorista_nome.trim() || 'Sem motorista'
    case 'cod_pdv':
      // PDV tratado como texto: trim + fallback
      return String(r.codigo_pdv ?? '').trim() || 'Sem código'
    case 'data':
      return formatarData(r.data_rota)
    case 'motivo':
      return r.motivo?.trim() || 'Sem motivo'
    case 'rota':
      return r.rota?.trim() || 'Sem rota'
  }
}

// ─── Função principal ─────────────────────────────────────────────────────────

/**
 * calcularReversao
 *
 * Agrupa os registros pela dimensão escolhida e calcula:
 *   - qtd_rev               → SUM(flag_reversao)
 *   - qtd_dev               → SUM(flag_devolucao)
 *   - total_oportunidades   → qtd_rev + qtd_dev
 *   - percentual_reversao   → qtd_rev / total_oportunidades  (0 se total = 0)
 *
 * Registros que não são reversão nem devolução são ignorados.
 * Ordenado por qtd_rev DESC, depois por percentual_reversao DESC.
 */
export function calcularReversao(
  dados:       RegistroReversao[],
  agrupamento: Agrupamento,
): ResultadoReversao[] {
  const mapa = new Map<string, { qtd_rev: number; qtd_dev: number }>()

  // Status que compõem QTD DEV
  const STATUS_DEV = new Set(['devolvido', 'devolvido_parcial', 'em_tratamento'])

  for (const r of dados) {
    // QTD REV: coluna reattempt = 1 na planilha → pdv_repasse no banco
    const flag_reversao = (r.pdv_repasse ?? 0) > 0 ? 1 : 0

    // QTD DEV: devolvido + devolvido_parcial + tratativa_aberta
    // Um registro pode ter flag_devolucao E flag_reversao = 1 ao mesmo tempo
    // (devolvido que também teve reattempt conta nos dois lados)
    const flag_devolucao = STATUS_DEV.has(r.status_final ?? '') ? 1 : 0

    if (flag_reversao === 0 && flag_devolucao === 0) continue

    const chave = getChave(r, agrupamento)
    const atual = mapa.get(chave) ?? { qtd_rev: 0, qtd_dev: 0 }
    mapa.set(chave, {
      qtd_rev: atual.qtd_rev + flag_reversao,
      qtd_dev: atual.qtd_dev + flag_devolucao,
    })
  }

  const resultado: ResultadoReversao[] = []

  for (const [grupo, { qtd_rev, qtd_dev }] of mapa.entries()) {
    const total_oportunidades = qtd_rev + qtd_dev
    const percentual_reversao = total_oportunidades > 0
      ? qtd_rev / total_oportunidades
      : 0

    resultado.push({
      grupo,
      qtd_rev,
      qtd_dev,
      total_oportunidades,
      percentual_reversao,
      percentual_reversao_formatado: `${(percentual_reversao * 100)
        .toFixed(2)
        .replace('.', ',')}%`,
    })
  }

  // Ordenar: qtd_rev DESC → percentual_reversao DESC
  resultado.sort((a, b) =>
    b.qtd_rev !== a.qtd_rev
      ? b.qtd_rev - a.qtd_rev
      : b.percentual_reversao - a.percentual_reversao,
  )

  return resultado
}
