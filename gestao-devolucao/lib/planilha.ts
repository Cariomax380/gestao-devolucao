import * as XLSX from 'xlsx'
import { createClient } from './supabase-browser'
import { ClassificacaoMotivo, StatusFinal } from '@/types'

// De-para: status da planilha → status_final do sistema
const STATUS_MAP: Record<string, StatusFinal> = {
  CONCLUDED: 'entregue',
  DEFINITELY_RETURNED: 'devolvido',
  PARTIAL_DELIVERY: 'devolvido',
  RESCHEDULED: 'repasse',
  NOT_STARTED: 'tratativa_aberta',
}

// De-para: motivo original → { label PT, classificacao }
const MOTIVO_MAP: Record<string, { label: string; classificacao: ClassificacaoMotivo }> = {
  'closed POS':                           { label: 'PDV fechado',                    classificacao: 'Mercado' },
  'No money':                             { label: 'Sem dinheiro',                   classificacao: 'Mercado' },
  'Customer did not authorize collection':{ label: 'Cliente não autorizou coleta',   classificacao: 'Mercado' },
  'Did not place an order':               { label: 'Não fez pedido',                 classificacao: 'Vendas' },
  'Wrong/Duplicate order':                { label: 'Pedido errado/duplicado',        classificacao: 'Vendas' },
  'Payment method':                       { label: 'Forma de pagamento',             classificacao: 'Vendas' },
  'Loading error':                        { label: 'Erro de carregamento',           classificacao: 'Logístico' },
  'Without container':                    { label: 'Sem vasilhame',                  classificacao: 'Logístico' },
  'Delivery time':                        { label: 'Fora do horário',                classificacao: 'Logístico' },
  'Difficult access':                     { label: 'Acesso difícil',                 classificacao: 'Logístico' },
  'Not enough time':                      { label: 'Sem tempo na rota',              classificacao: 'Logístico' },
  'Address not found':                    { label: 'Endereço não encontrado',        classificacao: 'Logístico' },
}

function parseTime(ts: unknown): string | null {
  if (!ts) return null
  const d = new Date(ts as string)
  if (isNaN(d.getTime())) return null
  return d.toTimeString().slice(0, 5) // HH:MM
}

function parseDate(ts: unknown): string | null {
  if (!ts) return null
  const d = new Date(ts as string)
  if (isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

// Converte linhas brutas da planilha em registros normalizados por PDV
function normalizarLinhas(rows: Record<string, unknown>[]) {
  return rows.map((r) => {
    const motivoRaw = String(r.last_reason_waiting_modulation ?? '')
    const motivoInfo = MOTIVO_MAP[motivoRaw]
    const statusRaw = String(r.status ?? '')
    const isDevolvido = statusRaw === 'DEFINITELY_RETURNED' || statusRaw === 'PARTIAL_DELIVERY'

    return {
      // Identificação
      cdd:            String(r.distribution_center_id ?? ''),
      data_rota:      parseDate(r.tour_date),
      rota:           String(r.tour_display_id ?? ''),
      placa:          String(r.vehicle_license_plate ?? ''),
      motorista:      String(r.driver_external_id ?? ''),
      cliente:        String(r.poc_name ?? ''),
      codigo_pdv:     String(r.poc_external_id ?? ''),

      // Status e motivo
      status_final:           STATUS_MAP[statusRaw] ?? 'tratativa_aberta',
      motivo:                 motivoInfo?.label ?? motivoRaw ?? null,
      classificacao_motivo:   motivoInfo?.classificacao ?? null,

      // Volumes (cada linha = 1 PDV)
      pdvs_faturados:         1,
      pdvs_devolvidos:        isDevolvido ? 1 : 0,
      pdv_repasse:            statusRaw === 'RESCHEDULED' ? 1 : 0,
      volume_faturado_hl:     Number(r.volume_hectoliters_sum ?? 0),
      volume_devolvido_hl:    isDevolvido ? Number(r.total_refused_vol ?? 0) : 0,

      // Raio
      dentro_raio:    Boolean(r.within_radius),
      aderencia_raio: r.foxtrot_adherence != null ? Number(r.foxtrot_adherence) : null,

      // Horários
      horario_apontamento:    parseTime(r.arrived_at),
      horario_finalizacao:    parseTime(r.finished_at),
      horario_atendimento_cme: null,

      // Extras
      devolucao_antes_horario: null,
      evidencia:              null,
      recorrencia_pdv:        0,
      qtd_devolucoes_anteriores: 0,
      janela_entrega:         String(r.notification_time ?? ''),
      responsavel_acionado:   null,
      canal_contato:          null,
      resultado_contato:      null,
      alertas_apontados:      0,
      devolucoes_revertidas:  0,
      repasses_programados:   0,
      repasses_informados:    0,
      repasses_realizados:    0,
      rn: null, gv: null, supervisor: null, vendas: null,
    }
  })
}

// Agrupa PDVs por rota para o drill-down
export function agruparPorRota(pdvs: ReturnType<typeof normalizarLinhas>) {
  const grupos: Record<string, {
    rota: string
    motorista: string
    data_rota: string | null
    cdd: string
    placa: string
    pdvs_faturados: number
    pdvs_devolvidos: number
    pdvs_repasse: number
    volume_faturado_hl: number
    volume_devolvido_hl: number
    pct_devolucao: number
    pct_repasse: number
    pdvs: typeof pdvs
  }> = {}

  for (const pdv of pdvs) {
    const key = pdv.rota
    if (!grupos[key]) {
      grupos[key] = {
        rota: pdv.rota,
        motorista: pdv.motorista,
        data_rota: pdv.data_rota,
        cdd: pdv.cdd,
        placa: pdv.placa,
        pdvs_faturados: 0,
        pdvs_devolvidos: 0,
        pdvs_repasse: 0,
        volume_faturado_hl: 0,
        volume_devolvido_hl: 0,
        pct_devolucao: 0,
        pct_repasse: 0,
        pdvs: [],
      }
    }
    grupos[key].pdvs_faturados      += pdv.pdvs_faturados
    grupos[key].pdvs_devolvidos     += pdv.pdvs_devolvidos
    grupos[key].pdvs_repasse        += pdv.pdv_repasse
    grupos[key].volume_faturado_hl  += pdv.volume_faturado_hl
    grupos[key].volume_devolvido_hl += pdv.volume_devolvido_hl
    grupos[key].pdvs.push(pdv)
  }

  // Calcular percentuais após consolidar todos os PDVs da rota
  for (const g of Object.values(grupos)) {
    g.pct_devolucao = g.pdvs_faturados > 0
      ? (g.pdvs_devolvidos / g.pdvs_faturados) * 100
      : 0

    // % repasse = repasses / (devolvidos + repasses)
    const base = g.pdvs_devolvidos + g.pdvs_repasse
    g.pct_repasse = base > 0
      ? (g.pdvs_repasse / base) * 100
      : 0
  }

  return Object.values(grupos)
}

const COLUNAS_OBRIGATORIAS = [
  'distribution_center_id',
  'tour_date',
  'driver_external_id',
  'poc_external_id',
  'status',
]

export async function processarPlanilha(
  file: File,
  onProgress?: (msg: string) => void
): Promise<{ ok: boolean; importacao_id?: string; erros: string[] }> {
  const erros: string[] = []
  onProgress?.('Lendo arquivo...')

  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(new Uint8Array(buffer), { type: 'buffer', cellDates: true, WTF: false })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null })

  if (!rows.length) return { ok: false, erros: ['Arquivo vazio'] }

  // Validar colunas obrigatórias
  const colunas = Object.keys(rows[0])
  const ausentes = COLUNAS_OBRIGATORIAS.filter(c => !colunas.includes(c))
  if (ausentes.length) {
    erros.push(`Colunas obrigatórias ausentes: ${ausentes.join(', ')}`)
    return { ok: false, erros }
  }

  onProgress?.(`${rows.length} linhas encontradas. Normalizando...`)

  const supabase = createClient()

  // Registrar importação
  const { data: imp, error: impErr } = await supabase
    .from('importacoes')
    .insert({ nome_arquivo: file.name, total_linhas: rows.length, status: 'processando' })
    .select('id')
    .single()

  if (impErr || !imp) {
    return { ok: false, erros: [`Erro ao registrar importação: ${impErr?.message}`] }
  }

  const importacao_id = imp.id
  const pdvs = normalizarLinhas(rows).map(p => ({ ...p, importacao_id }))

  // Inserir em batches de 500
  const BATCH = 500
  let erroCount = 0
  for (let i = 0; i < pdvs.length; i += BATCH) {
    const batch = pdvs.slice(i, i + BATCH)
    onProgress?.(`Inserindo ${i + batch.length}/${pdvs.length}...`)
    const { error } = await supabase.from('devolucoes').insert(batch)
    if (error) {
      erroCount += batch.length
      onProgress?.(`Erro no batch: ${error.message}`)
    }
  }

  await supabase
    .from('importacoes')
    .update({ status: erroCount ? 'parcial' : 'concluido', erros: erroCount })
    .eq('id', importacao_id)

  onProgress?.('Concluído.')
  return { ok: true, importacao_id, erros }
}
