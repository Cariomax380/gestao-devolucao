import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { STATUS_MAP, MOTIVO_MAP } from '@/lib/mappings'
import { gerarPlanoAcao } from '@/lib/acoes'

export const maxDuration = 300

const COLUNAS_OBRIGATORIAS = [
  'distribution_center_id', 'tour_date', 'driver_external_id', 'poc_external_id', 'status',
]

// PDVs excluídos da contagem de quantidade (faturados/devolvidos)
// mas o volume HL deles entra normalmente na somatória de HL
// Comparação numérica para tolerar zeros à esquerda e tipos diferentes (string/number)
const PDVS_EXCLUIDOS = new Set([
  26250, 23390, 17409, 17450, 27865, 27095, 27919, 29243, 28668, 23205,
  26683, 29214, 19117, 24183, 23407, 22781, 22779, 23948, 24296, 10935,
  29537, 30389, 31248, 35190, 31953, 35199, 35210, 30392, 30390, 15660,
  33409, 33651, 34261, 34619, 35200, 35992, 36920, 37662, 37960, 37728,
  40216, 40217, 40328, 29665, 45630, 45746, 47651, 47652, 47785, 47929,
  47930, 47933, 47935, 47936, 47940, 49236, 49234, 49239, 49233, 49238,
  49527,
])

function isPdvExcluido(codigoRaw: unknown): boolean {
  const n = Number(String(codigoRaw ?? '').trim())
  return !isNaN(n) && PDVS_EXCLUIDOS.has(n)
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseTime(ts: unknown): string | null {
  if (!ts) return null
  const s = String(ts).trim()
  // Horário já formatado (HH:MM ou HH:MM:SS) — preserva como horário local
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(s)) return s.slice(0, 5)
  const d = new Date(s)
  if (isNaN(d.getTime())) return null
  // Converte para horário de Brasília (UTC-3) usando aritmética UTC pura
  // para evitar dependência do fuso do servidor
  const local = new Date(d.getTime() - 3 * 60 * 60 * 1000)
  const hh = String(local.getUTCHours()).padStart(2, '0')
  const mm = String(local.getUTCMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
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
    // Serial Excel → UTC puro; usa getUTC* para consistência com parseDate
    if (!isNaN(d.getTime()))
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
  }
  const d = new Date(ts as string)
  if (isNaN(d.getTime())) return ''
  // Usa UTC para não divergir de parseDate (que usa toISOString = UTC)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

function normalizar(r: Record<string, unknown>, importacaoId: string) {
  const statusRaw  = String(r.status ?? '').toUpperCase().trim()
  const motivoRaw  = String(r.last_reason_waiting_modulation ?? '')
  const motivoInfo = MOTIVO_MAP[motivoRaw]
  const statusFinal = STATUS_MAP[statusRaw] ?? 'tratativa_aberta'
  // WAITING_MODULATION → 'em_tratamento' no STATUS_MAP; deve contar como
  // devolvido assim como IN_TREATMENT / EM TRATAMENTO.
  const isDevolvido = ['DEVOLVIDO', 'ENTREGA PARCIAL', 'EM TRATAMENTO',
    'DEFINITELY_RETURNED', 'PARTIAL_DELIVERY', 'IN_TREATMENT',
    'WAITING_MODULATION'].includes(statusRaw)

  // pdv_repasse = 1 SOMENTE quando reattempt=1 E a retentativa foi bem-sucedida.
  // DEFINITELY_RETURNED + reattempt=1 = retentativa falha → ainda é devolução (DEV).
  // NÃO é o status RESCHEDULED — esse é apenas reagendamento.
  const pdvRepasse = Number(r.reattempt ?? 0) > 0 && !isDevolvido ? 1 : 0

  // pdvDevolvido = 1 quando o status é de devolução.
  // Como pdvRepasse já é 0 para qualquer status de devolução, a condição simplifica.
  const pdvDevolvido = isDevolvido ? 1 : 0

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
    status_final:     statusFinal,
    motivo:           motivoInfo?.label ?? (motivoRaw || null),
    classificacao_motivo: motivoInfo?.classificacao ?? null,
    // pdvs_faturados: contado pelo código do PDV, exceto os explicitamente excluídos
    pdvs_faturados:   isPdvExcluido(r.poc_external_id) ? 0 : 1,
    pdvs_devolvidos:  isPdvExcluido(r.poc_external_id) ? 0 : pdvDevolvido,
    pdv_repasse:      pdvRepasse,
    volume_faturado_hl:  Number(r.total_delivered_vol ?? 0) + Number(r.total_refused_vol ?? 0),
    volume_devolvido_hl: pdvDevolvido ? Number(r.total_refused_vol ?? 0) : 0,
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
  filename:          string
  batchNum:          number   // 1-indexado
  totalBatches:      number
  totalLinhas:       number   // total de linhas do arquivo completo
  importacaoId:      string | null
  periodosNoArquivo?: string[] // todos os períodos detectados no arquivo (suporte a consolidado)
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

  // ── Validação de body ────────────────────────────────────────────────────────
  let body: { rows: Record<string, unknown>[]; meta: BatchMeta }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido: JSON malformado' }, { status: 400 })
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Body inválido: objeto esperado' }, { status: 400 })
  }

  const { rows, meta } = body as { rows: unknown; meta: unknown }

  if (!Array.isArray(rows)) {
    return NextResponse.json({ error: 'Body inválido: "rows" deve ser um array' }, { status: 400 })
  }

  if (
    !meta || typeof meta !== 'object' ||
    typeof (meta as Record<string, unknown>).filename      !== 'string' ||
    typeof (meta as Record<string, unknown>).batchNum      !== 'number' ||
    typeof (meta as Record<string, unknown>).totalBatches  !== 'number' ||
    typeof (meta as Record<string, unknown>).totalLinhas   !== 'number' ||
    !((meta as Record<string, unknown>).importacaoId === null ||
      typeof (meta as Record<string, unknown>).importacaoId === 'string')
  ) {
    return NextResponse.json(
      { error: 'Body inválido: "meta" com campos ausentes ou tipo incorreto (filename, batchNum, totalBatches, totalLinhas, importacaoId)' },
      { status: 400 },
    )
  }

  const typedMeta = meta as BatchMeta
  const { filename, batchNum, totalBatches, totalLinhas, importacaoId: existingId, periodosNoArquivo } = typedMeta
  const typedRows = rows as Record<string, unknown>[]

  // Filtra linhas em branco (Excel costuma incluir linhas vazias no final)
  const rowsFiltradas = typedRows.filter(r =>
    r.distribution_center_id != null && String(r.distribution_center_id).trim() !== '' &&
    r.tour_date != null &&
    r.status != null && String(r.status).trim() !== ''
  )

  if (!rowsFiltradas.length) return NextResponse.json({ ok: true, importacaoId: existingId, limpeza: 'nenhuma', insertError: null, statusCount: {} })

  // Usa a primeira linha válida (não a raw typedRows[0] que pode ser em branco)
  const novoCDD    = String(rowsFiltradas[0].distribution_center_id ?? '')
  const novoPeriodo = getPeriodo(rowsFiltradas[0].tour_date)

  let importacaoId = existingId
  let limpeza = 'nenhuma'

  // ── Primeiro lote: valida colunas + limpeza + cria registro de importação ──
  if (batchNum === 1) {
    const colunas = Object.keys(typedRows[0] ?? {})
    const ausentes = COLUNAS_OBRIGATORIAS.filter(c => !colunas.includes(c))
    if (ausentes.length) {
      return NextResponse.json({ error: `Colunas ausentes: ${ausentes.join(', ')}` }, { status: 400 })
    }

    const { data: impExist } = await supabase.from('importacoes').select('id, cdd, periodo').eq('user_id', user.id)

    if (impExist && impExist.length > 0) {
      const cddExistente = impExist[0].cdd

      if (cddExistente !== novoCDD) {
        // CDD diferente: limpa tudo
        const ids = impExist.map(i => i.id)
        for (const id of ids) await supabase.from('devolucoes').delete().eq('importacao_id', id)
        await supabase.from('importacoes').delete().in('id', ids)
        limpeza = 'total'
      } else {
        // Mesmo CDD: apaga devolucoes diretamente por (cdd, periodo)
        // Garante limpeza correta mesmo quando imports anteriores eram consolidados
        // (ex.: import multi-mês registrado com periodo='2026-01' mas contendo dados de 2026-01 a 2026-06)
        const periodosParaLimpar = periodosNoArquivo?.length ? periodosNoArquivo : [novoPeriodo]
        await supabase.from('devolucoes').delete().eq('cdd', novoCDD).in('periodo', periodosParaLimpar)

        // Remove importacoes que ficaram sem devolucoes vinculadas (órfãos).
        // Uma única query busca todos os importacao_ids que ainda têm linhas,
        // evitando o loop N+1 anterior.
        const importIds = impExist.map(i => i.id)
        const { data: comDev } = await supabase
          .from('devolucoes')
          .select('importacao_id')
          .in('importacao_id', importIds)
        const idsComDev = new Set((comDev ?? []).map((r: { importacao_id: string }) => r.importacao_id))
        const orphans   = importIds.filter(id => !idsComDev.has(id))
        if (orphans.length) await supabase.from('importacoes').delete().in('id', orphans)
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
  const pdvs = rowsFiltradas.map(r => normalizar(r, importacaoId!))
  const { error: insertErr } = await supabase.from('devolucoes').insert(pdvs)

  // Contagem de status normalizados para diagnóstico (apenas linhas válidas)
  const statusCount: Record<string, number> = {}
  for (const r of rowsFiltradas) {
    const s = String(r.status ?? '(vazio)').toUpperCase().trim()
    statusCount[s] = (statusCount[s] ?? 0) + 1
  }

  // ── Último lote: finaliza e gera plano de ação ────────────────────────────
  if (batchNum === totalBatches) {
    await supabase
      .from('importacoes')
      .update({ status: insertErr ? 'parcial' : 'concluido' })
      .eq('id', importacaoId)

    // Só gera plano se a inserção foi completa — dados parciais geram metas erradas
    if (!insertErr) await gerarPlanoAcao(supabase, importacaoId, novoPeriodo, user.id)
  }

  return NextResponse.json({
    ok: true,
    importacaoId,
    limpeza,
    insertError: insertErr ? `Lote ${batchNum}: ${insertErr.message}` : null,
    statusCount,
  })
}

// gerarPlanoAcao movida para lib/acoes.ts
