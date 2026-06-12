import React from 'react'
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'

// ── Types ─────────────────────────────────────────────────────────────────────

export type ResumoKPI = {
  pdvs_faturados: number
  pdvs_devolvidos: number
  pdv_repasse: number
  vol_faturado: number | null
  vol_devolvido: number | null
}

export type MotivoRow    = { motivo: string; qtd: number; pct: number }
export type MotoristaRow = { nome: string; dev: number; fat: number; pct: number }

export type GatilhoRow = {
  data_rota:    string
  pdvs_fat:     number
  pdvs_dev:     number
  pct_dev:      number
  media_prev:   number
  desvio_prev:  number
  periodo_ref:  string
}

export type AcaoRow = {
  descricao:   string
  responsavel: string | null
  prazo:       string | null
  status:      string
  prioridade:  string
}

export type RelatorioDados = {
  resumo:      ResumoKPI | null
  motivos:     MotivoRow[]
  motoristas:  MotoristaRow[]
  gatilho:     GatilhoRow[]
  acoes:       AcaoRow[]
  periodo:     string | null
  geradoEm:    string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtPct(v: number | null | undefined): string {
  if (v == null || isNaN(Number(v))) return '—'
  return `${Number(v).toFixed(1)}%`
}

function fmtNum(v: number | null | undefined): string {
  if (v == null) return '—'
  return Number(v).toLocaleString('pt-BR')
}

function fmtPeriodo(p: string | null): string {
  if (!p) return 'Todos os períodos'
  if (p.length === 7) {
    const [y, m] = p.split('-')
    const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
    return `${meses[parseInt(m) - 1]}/${y}`
  }
  return p
}

function fmtData(d: string): string {
  const p = d.split('-')
  return p.length >= 3 ? `${p[2]}/${p[1]}` : d
}

function fmtPrazo(d: string | null): string {
  if (!d) return '—'
  return fmtData(d.substring(0, 10))
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// ── Design tokens ─────────────────────────────────────────────────────────────

const C = {
  azul:        '#003087',
  amarelo:     '#F2C800',
  azulMed:     '#0057A8',
  cinza:       '#6B7280',
  cinzaClaro:  '#F9FAFB',
  cinzaBorda:  '#F3F4F6',
  branco:      '#FFFFFF',
  verde:       '#059669',
  verdeBg:     '#D1FAE5',
  amareloText: '#D97706',
  amareloBg:   '#FEF3C7',
  vermelho:    '#DC2626',
  vermelhoBg:  '#FEE2E2',
  azulText:    '#1D4ED8',
  azulBg:      '#DBEAFE',
  text:        '#1F2937',
  textMid:     '#374151',
}

const s = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    backgroundColor: C.branco,
    color: C.text,
    fontSize: 9,
  },
  // Header bar
  header: {
    backgroundColor: C.azul,
    paddingHorizontal: 40,
    paddingTop: 28,
    paddingBottom: 18,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: C.branco,
    marginBottom: 3,
  },
  headerAccent: { color: C.amarelo },
  headerSub:  { fontSize: 10, color: '#93C5FD', marginBottom: 2 },
  headerMeta: { fontSize: 8,  color: '#BFDBFE' },
  // Content wrapper
  content: {
    paddingHorizontal: 40,
    paddingTop: 16,
    paddingBottom: 44,
  },
  // Section title
  sectionTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: C.azul,
    marginTop: 18,
    marginBottom: 7,
    paddingBottom: 3,
    borderBottomWidth: 2,
    borderBottomColor: C.amarelo,
  },
  sectionFirst: { marginTop: 0 },
  // KPI row
  kpiRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: C.cinzaClaro,
    borderRadius: 5,
    padding: 9,
    borderLeftWidth: 3,
    borderLeftColor: C.amarelo,
    marginRight: 7,
  },
  kpiCardLast: { marginRight: 0 },
  kpiLabel: { fontSize: 7, color: C.cinza, marginBottom: 3 },
  kpiValue: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: C.azul },
  kpiSub:   { fontSize: 7, color: C.cinza, marginTop: 2 },
  // Table
  tHead: {
    flexDirection: 'row',
    backgroundColor: C.azul,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 3,
  },
  th: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: C.branco },
  tRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.cinzaBorda,
  },
  tRowAlt: { backgroundColor: C.cinzaClaro },
  td: { fontSize: 8, color: C.textMid },
  // Badge
  badge: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  // Gatilho stats
  gStatRow: { flexDirection: 'row', marginBottom: 10 },
  gStat: {
    flex: 1,
    backgroundColor: '#EFF6FF',
    borderRadius: 5,
    padding: 9,
    marginRight: 7,
  },
  gStatLast:  { marginRight: 0 },
  gStatLabel: { fontSize: 7, color: C.cinza, marginBottom: 2 },
  gStatValue: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: C.azulMed },
  // Empty state
  empty: { fontSize: 9, color: C.cinza, marginTop: 4 },
  // Footer
  footer: {
    position: 'absolute',
    bottom: 14,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: { fontSize: 7, color: C.cinza },
})

// ── Sub-components ────────────────────────────────────────────────────────────

function PageHeader({ periodo, geradoEm }: { periodo: string; geradoEm: string }) {
  return (
    <View style={s.header} fixed>
      <Text style={s.headerTitle}>
        Gestão de Devolução<Text style={s.headerAccent}>.</Text>
      </Text>
      <Text style={s.headerSub}>Relatório Mensal — {periodo}</Text>
      <Text style={s.headerMeta}>Gerado em {geradoEm}</Text>
    </View>
  )
}

function PageFooter() {
  return (
    <View style={s.footer} fixed>
      <Text style={s.footerText}>Painel CDD — Gestão de Devolução</Text>
      <Text
        style={s.footerText}
        render={({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
          `Pág. ${pageNumber} / ${totalPages}`
        }
      />
    </View>
  )
}

function Badge({ label, bg, color }: { label: string; bg: string; color: string }) {
  return <Text style={[s.badge, { backgroundColor: bg, color }]}>{label}</Text>
}

// ── Main document ─────────────────────────────────────────────────────────────

export function RelatorioPDF({ dados }: { dados: RelatorioDados }) {
  const { resumo, motivos, motoristas, gatilho, acoes, periodo, geradoEm } = dados

  const fat  = resumo?.pdvs_faturados  ?? 0
  const dev  = resumo?.pdvs_devolvidos ?? 0
  const rep  = resumo?.pdv_repasse     ?? 0
  const vfat = resumo?.vol_faturado    ?? null
  const vdev = resumo?.vol_devolvido   ?? null

  const pctDev = fat > 0 ? (dev / fat) * 100 : null
  const pctRep = (dev + rep) > 0 ? (rep / (dev + rep)) * 100 : null
  const pctHL  = vfat ? ((vdev ?? 0) / vfat) * 100 : null

  const periodoLabel = fmtPeriodo(periodo)

  // Gatilho stats
  const SIGMA    = 1.0
  const g0       = gatilho[0] ?? null
  const gatilhoLimiar  = g0 ? g0.media_prev + SIGMA * g0.desvio_prev : null
  const diasEstouro    = gatilhoLimiar != null
    ? gatilho.filter(r => r.pct_dev > gatilhoLimiar).length
    : 0

  const STATUS_BADGE: Record<string, { bg: string; color: string; label: string }> = {
    aberto:            { bg: C.amareloBg,  color: C.amareloText, label: 'Aberto'     },
    em_andamento:      { bg: C.azulBg,     color: C.azulText,    label: 'Andamento'  },
    concluido:         { bg: C.verdeBg,    color: C.verde,       label: 'Concluído'  },
    cancelado:         { bg: C.cinzaClaro, color: C.cinza,       label: 'Cancelado'  },
  }

  const PRIO_BADGE: Record<string, { bg: string; color: string; label: string }> = {
    critica:       { bg: C.vermelhoBg, color: C.vermelho,    label: 'Crítica'     },
    alta:          { bg: C.amareloBg,  color: C.amareloText, label: 'Alta'        },
    media:         { bg: C.azulBg,     color: C.azulText,    label: 'Média'       },
    monitoramento: { bg: C.cinzaClaro, color: C.cinza,       label: 'Monitor.'    },
  }

  return (
    <Document>

      {/* ── Página 1: KPIs + Motivos + Motoristas ────────────────────── */}
      <Page size="A4" style={s.page}>
        <PageHeader periodo={periodoLabel} geradoEm={geradoEm} />

        <View style={s.content}>
          {/* KPIs linha 1 */}
          <Text style={[s.sectionTitle, s.sectionFirst]}>Resumo do Período</Text>
          <View style={s.kpiRow}>
            <View style={s.kpiCard}>
              <Text style={s.kpiLabel}>PDVs Faturados</Text>
              <Text style={s.kpiValue}>{fmtNum(fat)}</Text>
            </View>
            <View style={s.kpiCard}>
              <Text style={s.kpiLabel}>PDVs Devolvidos</Text>
              <Text style={s.kpiValue}>{fmtNum(dev)}</Text>
            </View>
            <View style={s.kpiCard}>
              <Text style={s.kpiLabel}>% Devolução PDV</Text>
              <Text style={[s.kpiValue, { color: pctDev != null && pctDev > 5 ? C.vermelho : C.azul }]}>
                {fmtPct(pctDev)}
              </Text>
            </View>
            <View style={[s.kpiCard, s.kpiCardLast]}>
              <Text style={s.kpiLabel}>% Reversão</Text>
              <Text style={[s.kpiValue, { color: C.azulMed }]}>{fmtPct(pctRep)}</Text>
              <Text style={s.kpiSub}>{fmtNum(rep)} repasses</Text>
            </View>
          </View>

          {/* KPIs linha 2 */}
          <View style={s.kpiRow}>
            <View style={s.kpiCard}>
              <Text style={s.kpiLabel}>Vol. Faturado HL</Text>
              <Text style={s.kpiValue}>{vfat != null ? vfat.toFixed(1) : '—'}</Text>
            </View>
            <View style={s.kpiCard}>
              <Text style={s.kpiLabel}>Vol. Devolvido HL</Text>
              <Text style={s.kpiValue}>{vdev != null ? vdev.toFixed(1) : '—'}</Text>
            </View>
            <View style={s.kpiCard}>
              <Text style={s.kpiLabel}>% Devolução HL</Text>
              <Text style={s.kpiValue}>{fmtPct(pctHL)}</Text>
            </View>
            <View style={[s.kpiCard, s.kpiCardLast]}>
              <Text style={s.kpiLabel}>Ações Abertas</Text>
              <Text style={[s.kpiValue, { color: acoes.length > 0 ? C.amareloText : C.verde }]}>
                {acoes.length}
              </Text>
              <Text style={s.kpiSub}>aberto / em andamento</Text>
            </View>
          </View>

          {/* Top Motivos */}
          <Text style={s.sectionTitle}>Top Motivos de Devolução</Text>
          <View style={s.tHead}>
            <Text style={[s.th, { flex: 4 }]}>Motivo</Text>
            <Text style={[s.th, { flex: 1, textAlign: 'right' }]}>Qtd</Text>
            <Text style={[s.th, { flex: 1, textAlign: 'right' }]}>% Total</Text>
          </View>
          {motivos.slice(0, 10).map((m, i) => (
            <View key={m.motivo} style={[s.tRow, i % 2 === 1 ? s.tRowAlt : {}]}>
              <Text style={[s.td, { flex: 4 }]}>{m.motivo}</Text>
              <Text style={[s.td, { flex: 1, textAlign: 'right' }]}>{fmtNum(m.qtd)}</Text>
              <Text style={[s.td, { flex: 1, textAlign: 'right', fontFamily: 'Helvetica-Bold', color: C.azul }]}>
                {fmtPct(m.pct)}
              </Text>
            </View>
          ))}

          {/* Top Motoristas */}
          <Text style={s.sectionTitle}>Top Motoristas Ofensores</Text>
          <View style={s.tHead}>
            <Text style={[s.th, { flex: 4 }]}>Motorista</Text>
            <Text style={[s.th, { flex: 1, textAlign: 'right' }]}>Dev.</Text>
            <Text style={[s.th, { flex: 1, textAlign: 'right' }]}>Fat.</Text>
            <Text style={[s.th, { flex: 1, textAlign: 'right' }]}>% Dev</Text>
          </View>
          {motoristas.slice(0, 8).map((m, i) => (
            <View key={m.nome + i} style={[s.tRow, i % 2 === 1 ? s.tRowAlt : {}]}>
              <Text style={[s.td, { flex: 4 }]}>{m.nome}</Text>
              <Text style={[s.td, { flex: 1, textAlign: 'right' }]}>{fmtNum(m.dev)}</Text>
              <Text style={[s.td, { flex: 1, textAlign: 'right' }]}>{fmtNum(m.fat)}</Text>
              <Text style={[s.td, {
                flex: 1, textAlign: 'right',
                fontFamily: 'Helvetica-Bold',
                color: m.pct > 10 ? C.vermelho : C.azul,
              }]}>
                {fmtPct(m.pct)}
              </Text>
            </View>
          ))}
        </View>

        <PageFooter />
      </Page>

      {/* ── Página 2: Gatilho + Plano de Ação ───────────────────────── */}
      <Page size="A4" style={s.page}>
        <PageHeader periodo={periodoLabel} geradoEm={geradoEm} />

        <View style={s.content}>
          {/* Gestão de Gatilho */}
          <Text style={[s.sectionTitle, s.sectionFirst]}>Gestão de Gatilho Estatístico (μ + 1σ)</Text>

          {g0 ? (
            <>
              <View style={s.gStatRow}>
                <View style={s.gStat}>
                  <Text style={s.gStatLabel}>Média histórica (μ)</Text>
                  <Text style={s.gStatValue}>{fmtPct(g0.media_prev)}</Text>
                  <Text style={[s.kpiSub, { marginTop: 2 }]}>ref: {fmtPeriodo(g0.periodo_ref)}</Text>
                </View>
                <View style={s.gStat}>
                  <Text style={s.gStatLabel}>Desvio padrão (σ)</Text>
                  <Text style={s.gStatValue}>{fmtPct(g0.desvio_prev)}</Text>
                </View>
                <View style={s.gStat}>
                  <Text style={s.gStatLabel}>Gatilho (μ + 1σ)</Text>
                  <Text style={[s.gStatValue, { color: C.amareloText }]}>
                    {fmtPct(gatilhoLimiar)}
                  </Text>
                </View>
                <View style={[s.gStat, s.gStatLast]}>
                  <Text style={s.gStatLabel}>Dias em estouro</Text>
                  <Text style={[s.gStatValue, { color: diasEstouro > 0 ? C.vermelho : C.verde }]}>
                    {diasEstouro} / {gatilho.length}
                  </Text>
                </View>
              </View>

              <View style={s.tHead}>
                <Text style={[s.th, { flex: 1 }]}>Data</Text>
                <Text style={[s.th, { flex: 1, textAlign: 'right' }]}>% Dev</Text>
                <Text style={[s.th, { flex: 1, textAlign: 'right' }]}>Gatilho</Text>
                <Text style={[s.th, { flex: 1, textAlign: 'right' }]}>Fat.</Text>
                <Text style={[s.th, { flex: 1, textAlign: 'right' }]}>Dev.</Text>
                <Text style={[s.th, { flex: 1.2, textAlign: 'center' }]}>Zona</Text>
              </View>
              {gatilho.map((r, i) => {
                const lim     = r.media_prev + SIGMA * r.desvio_prev
                const estouro = r.pct_dev > lim
                const atencao = !estouro && r.pct_dev > r.media_prev + r.desvio_prev
                const zona    = estouro
                  ? { bg: C.vermelhoBg, color: C.vermelho,    label: 'Crítico'  }
                  : atencao
                  ? { bg: C.amareloBg,  color: C.amareloText, label: 'Atenção'  }
                  : { bg: C.verdeBg,    color: C.verde,        label: 'Normal'   }
                return (
                  <View key={r.data_rota} style={[s.tRow, i % 2 === 1 ? s.tRowAlt : {}]}>
                    <Text style={[s.td, { flex: 1 }]}>{fmtData(r.data_rota)}</Text>
                    <Text style={[s.td, {
                      flex: 1, textAlign: 'right',
                      fontFamily: estouro ? 'Helvetica-Bold' : 'Helvetica',
                      color: estouro ? C.vermelho : C.textMid,
                    }]}>
                      {fmtPct(r.pct_dev)}
                    </Text>
                    <Text style={[s.td, { flex: 1, textAlign: 'right', color: C.cinza }]}>
                      {fmtPct(lim)}
                    </Text>
                    <Text style={[s.td, { flex: 1, textAlign: 'right' }]}>{fmtNum(r.pdvs_fat)}</Text>
                    <Text style={[s.td, { flex: 1, textAlign: 'right' }]}>{fmtNum(r.pdvs_dev)}</Text>
                    <View style={{ flex: 1.2, alignItems: 'center', justifyContent: 'center' }}>
                      <Badge label={zona.label} bg={zona.bg} color={zona.color} />
                    </View>
                  </View>
                )
              })}
            </>
          ) : (
            <Text style={s.empty}>Sem dados de gatilho para o período selecionado.</Text>
          )}

          {/* Plano de Ação */}
          <Text style={s.sectionTitle}>Plano de Ação — Ações em Aberto</Text>
          {acoes.length === 0 ? (
            <Text style={[s.empty, { color: C.verde }]}>Nenhuma ação aberta ou em andamento.</Text>
          ) : (
            <>
              <View style={s.tHead}>
                <Text style={[s.th, { flex: 4 }]}>Descrição</Text>
                <Text style={[s.th, { flex: 2 }]}>Responsável</Text>
                <Text style={[s.th, { flex: 1, textAlign: 'center' }]}>Prazo</Text>
                <Text style={[s.th, { flex: 1.2, textAlign: 'center' }]}>Prior.</Text>
                <Text style={[s.th, { flex: 1.3, textAlign: 'center' }]}>Status</Text>
              </View>
              {acoes.map((a, i) => {
                const sc = STATUS_BADGE[a.status] ?? { bg: C.cinzaClaro, color: C.cinza, label: capitalize(a.status) }
                const pc = PRIO_BADGE[a.prioridade] ?? { bg: C.cinzaClaro, color: C.cinza, label: capitalize(a.prioridade) }
                return (
                  <View key={i} style={[s.tRow, i % 2 === 1 ? s.tRowAlt : {}]}>
                    <Text style={[s.td, { flex: 4 }]}>{a.descricao}</Text>
                    <Text style={[s.td, { flex: 2 }]}>{a.responsavel ?? '—'}</Text>
                    <Text style={[s.td, { flex: 1, textAlign: 'center' }]}>{fmtPrazo(a.prazo)}</Text>
                    <View style={{ flex: 1.2, alignItems: 'center', justifyContent: 'center' }}>
                      <Badge label={pc.label} bg={pc.bg} color={pc.color} />
                    </View>
                    <View style={{ flex: 1.3, alignItems: 'center', justifyContent: 'center' }}>
                      <Badge label={sc.label} bg={sc.bg} color={sc.color} />
                    </View>
                  </View>
                )
              })}
            </>
          )}
        </View>

        <PageFooter />
      </Page>
    </Document>
  )
}
