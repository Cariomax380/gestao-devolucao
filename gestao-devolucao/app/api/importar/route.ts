import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { getMotoristaMap } from '@/lib/motoristas'

export const maxDuration = 300

// ─── Mapeamentos (mantidos no servidor por segurança) ────────────────────────

const STATUS_MAP: Record<string, string> = {
  CONCLUDED:          'entregue',
  DEFINITELY_RETURNED:'devolvido',
  PARTIAL_DELIVERY:   'devolvido',
  RESCHEDULED:        'repasse',
  NOT_STARTED:        'tratativa_aberta',
}

const MOTIVO_MAP: Record<string, { label: string; classificacao: string }> = {
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

const COLUNAS_OBRIGATORIAS = [
  'distribution_center_id', 'tour_date', 'driver_external_id', 'poc_external_id', 'status',
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseTime(ts: unknown): string | null {
  if (!ts) return null
  const d = new Date(ts as string)
  if (isNaN(d.getTime())) return null
  return d.toTimeString().slice(0, 5)
}

function parseDate(ts: unknown): string | null {
  if (!ts) return null
  // Suporte a Excel serial date (número) e strings ISO
  if (typeof ts === 'number') {
    const d = new Date(Math.round((ts - 25569) * 86400 * 1000))
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  }
  const d = new Date(ts as string)
  if (isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

function getPeriodo(ts: unknown): string {
  if (!ts) return ''
  if (typeof ts === 'number') {
    const d = new Date(Math.round((ts - 25569) * 86400 * 1000))
    if (!isNaN(d.getTime()))
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }
  const d = new Date(ts as string)
  if (isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function normalizar(r: Record<string, unknown>, importacaoId: string) {
  const statusRaw  = String(r.status ?? '')
  const motivoRaw  = String(r.last_reason_waiting_modulation ?? '')
  const motivoInfo = MOTIVO_MAP[motivoRaw]
  const isDevolvido = statusRaw === 'DEFINITELY_RETURNED' || statusRaw === 'PARTIAL_DELIVERY'

  return {
    importacao_id:    importacaoId,
    cdd:              String(r.distribution_center_id ?? ''),
    periodo:          getPeriodo(r.tour_date) || null,
    data_rota:        parseDate(r.tour_date),
    rota:             String(r.tour_display_id ?? ''),
    placa:            String(r.vehicle_license_plate ?? ''),
    motorista:        String(r.driver_external_id ?? ''),
    cliente:          String(r.poc_name ?? ''),
    codigo_pdv:       String(r.poc_external_id ?? ''),
    status_final:     STATUS_MAP[statusRaw] ?? 'tratativa_aberta',
    motivo:           motivoInfo?.label ?? (motivoRaw || null),
    classificacao_motivo: motivoInfo?.classificacao ?? null,
    pdvs_faturados:   1,
    pdvs_devolvidos:  isDevolvido ? 1 : 0,
    pdv_repasse:      statusRaw === 'RESCHEDULED' ? 1 : 0,
    volume_faturado_hl:  Number(r.volume_hectoliters_sum ?? 0),
    volume_devolvido_hl: isDevolvido ? Number(r.total_refused_vol ?? 0) : 0,
    dentro_raio:      Boolean(r.within_radius),
    aderencia_raio:   r.foxtrot_adherence != null ? Number(r.foxtrot_adherence) : null,
    horario_apontamento:     parseTime(r.arrived_at),
    horario_finalizacao:     parseTime(r.finished_at),
    horario_atendimento_cme: null,
    janela_entrega:   String(r.notification_time ?? ''),
    alertas_apontados: 0, devolucoes_revertidas: 0,
    repasses_programados: 0, repasses_informados: 0, repasses_realizados: 0,
    recorrencia_pdv: 0, qtd_devolucoes_anteriores: 0,
    rn: null, gv: null, supervisor: null, vendas: null,
    devolucao_antes_horario: null, evidencia: null,
    responsavel_acionado: null, canal_contato: null, resultado_contato: null,
  }
}

// ─── Handler principal ───────────────────────────────────────────────────────

interface BatchMeta {
  filename:    string
  batchNum:    number   // 1-indexado
  totalBatches:number
  totalLinhas: number   // total de linhas do arquivo completo
  importacaoId: string | null
}

export async function POST(req: NextRequest) {
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const supabase = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const body: { rows: Record<string, unknown>[]; meta: BatchMeta } = await req.json()
  const { rows, meta } = body
  const { filename, batchNum, totalBatches, totalLinhas, importacaoId: existingId } = meta

  if (!rows?.length) return NextResponse.json({ error: 'Lote vazio' }, { status: 400 })

  const novoCDD    = String(rows[0].distribution_center_id ?? '')
  const novoPeriodo = getPeriodo(rows[0].tour_date)

  let importacaoId = existingId
  let limpeza = 'nenhuma'

  // ── Primeiro lote: valida colunas + limpeza + cria registro de importação ──
  if (batchNum === 1) {
    const colunas = Object.keys(rows[0])
    const ausentes = COLUNAS_OBRIGATORIAS.filter(c => !colunas.includes(c))
    if (ausentes.length) {
      return NextResponse.json({ error: `Colunas ausentes: ${ausentes.join(', ')}` }, { status: 400 })
    }

    const { data: impExist } = await supabase.from('importacoes').select('id, cdd, periodo')

    if (impExist && impExist.length > 0) {
      const cddExistente      = impExist[0].cdd
      const periodoExistente  = impExist.find(i => i.periodo === novoPeriodo && i.cdd === novoCDD)

      if (cddExistente !== novoCDD) {
        const ids = impExist.map(i => i.id)
        for (const id of ids) await supabase.from('devolucoes').delete().eq('importacao_id', id)
        await supabase.from('importacoes').delete().in('id', ids)
        limpeza = 'total'
      } else if (periodoExistente) {
        await supabase.from('devolucoes').delete().eq('importacao_id', periodoExistente.id)
        await supabase.from('importacoes').delete().eq('id', periodoExistente.id)
        limpeza = 'periodo'
      }
    }

    const { data: imp, error: impErr } = await supabase
      .from('importacoes')
      .insert({
        nome_arquivo: filename,
        total_linhas: totalLinhas,
        status:       'processando',
        user_id:      user.id,
        cdd:          novoCDD,
        periodo:      novoPeriodo,
      })
      .select('id')
      .single()

    if (impErr || !imp) {
      return NextResponse.json({ error: `Erro ao registrar: ${impErr?.message}` }, { status: 500 })
    }

    importacaoId = imp.id
  }

  if (!importacaoId) {
    return NextResponse.json({ error: 'importacaoId ausente nos lotes subsequentes' }, { status: 400 })
  }

  // ── Inserir lote normalizado ──────────────────────────────────────────────
  const pdvs = rows.map(r => normalizar(r, importacaoId!))
  const { error: insertErr } = await supabase.from('devolucoes').insert(pdvs)

  // ── Último lote: finaliza e gera plano de ação ────────────────────────────
  if (batchNum === totalBatches) {
    await supabase
      .from('importacoes')
      .update({ status: insertErr ? 'parcial' : 'concluido' })
      .eq('id', importacaoId)

    await gerarPlanoAcao(supabase, importacaoId, novoPeriodo, user.id)
  }

  return NextResponse.json({ ok: true, importacaoId, limpeza })
}

// ─── Plano de ação automático ─────────────────────────────────────────────────

async function gerarPlanoAcao(supabase: any, importacaoId: string, periodo: string, userId: string) {
  const [{ data: ofensores }, motMap] = await Promise.all([
    supabase
      .from('devolucoes')
      .select('motorista, pdvs_faturados, pdvs_devolvidos, volume_devolvido_hl')
      .eq('importacao_id', importacaoId),
    getMotoristaMap(),
  ])

  if (!ofensores?.length) return

  const porMotorista: Record<string, { fat: number; dev: number; vol: number }> = {}
  for (const r of ofensores) {
    const k = r.motorista
    if (!k) continue
    if (!porMotorista[k]) porMotorista[k] = { fat: 0, dev: 0, vol: 0 }
    porMotorista[k].fat += r.pdvs_faturados ?? 0
    porMotorista[k].dev += r.pdvs_devolvidos ?? 0
    porMotorista[k].vol += r.volume_devolvido_hl ?? 0
  }

  const acoes = []

  for (const [motorista, d] of Object.entries(porMotorista)) {
    if (d.fat < 5 || !motorista || motorista === 'desconhecido') continue
    const pct = d.fat > 0 ? (d.dev / d.fat) * 100 : 0
    const nome = motMap.get(String(motorista).trim()) ?? `cód. ${motorista}`

    if (pct >= 20) {
      acoes.push({
        descricao:    `Motorista ${nome} com ${pct.toFixed(1)}% de devolução no período ${periodo} — realizar acompanhamento individual e identificar causa raiz`,
        responsavel:  'Supervisor',
        prazo:        new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
        status:       'aberto',
        prioridade:   'critica',
        indicador_impactado: 'devolucao_pdv',
        criado_por:   userId,
      })
    } else if (pct >= 10) {
      acoes.push({
        descricao:    `Motorista ${nome} com ${pct.toFixed(1)}% de devolução — monitorar nas próximas rotas`,
        responsavel:  'Coordenador',
        prazo:        new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
        status:       'aberto',
        prioridade:   'alta',
        indicador_impactado: 'devolucao_pdv',
        criado_por:   userId,
      })
    }
  }

  const totalFat = Object.values(porMotorista).reduce((s, d) => s + d.fat, 0)
  const totalDev = Object.values(porMotorista).reduce((s, d) => s + d.dev, 0)
  const pctGeral = totalFat > 0 ? (totalDev / totalFat) * 100 : 0

  if (pctGeral >= 5) {
    acoes.push({
      descricao:    `Taxa geral de devolução em ${pctGeral.toFixed(1)}% no período ${periodo} — revisar processos operacionais`,
      responsavel:  'Coordenador',
      prazo:        new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
      status:       'aberto',
      prioridade:   pctGeral >= 10 ? 'critica' : 'alta',
      indicador_impactado: 'devolucao_pdv',
      criado_por:   userId,
    })
  }

  if (acoes.length > 0) await supabase.from('plano_acao').insert(acoes)
}
