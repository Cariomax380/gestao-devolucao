'use client'

import { useState, useRef } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Upload, FileSpreadsheet, CheckCircle2, XCircle, Loader2, Users, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase-browser'

interface ImportDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type Status = 'idle' | 'loading' | 'success' | 'error'
type Aba = 'devolucoes' | 'motoristas'

const BATCH_SIZE  = 500
const CONCURRENCY = 3
const COLUNAS_OBRIGATORIAS = [
  'distribution_center_id', 'tour_date', 'driver_external_id', 'poc_external_id', 'status',
]

// ─── Aba Devoluções — parse no client + envio em lotes ───────────────────────

function ImportTabDevolucoes() {
  const [status,     setStatus]     = useState<Status>('idle')
  const [arquivo,    setArquivo]    = useState<File | null>(null)
  const [log,        setLog]        = useState<string[]>([])
  const [dragging,   setDragging]   = useState(false)
  const [progress,   setProgress]   = useState<{ current: number; total: number } | null>(null)
  const [confirmCDD, setConfirmCDD] = useState<{ atual: string; novo: string } | null>(null)
  const parsedRowsRef    = useRef<Record<string, unknown>[] | null>(null)
  const parsedPeriodosRef = useRef<string[]>([])
  const statusAcum = useRef<Record<string, number>>({})
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFile(file: File) {
    if (!file.name.match(/\.(xlsx|csv)$/i)) {
      setLog(['Arquivo inválido. Use: .xlsx ou .csv'])
      setStatus('error')
      return
    }
    setArquivo(file)
    setStatus('idle')
    setLog([])
    setProgress(null)
    setConfirmCDD(null)
    parsedRowsRef.current = null
  }

  async function sendBatches(rows: Record<string, unknown>[], periodosNoArquivo: string[]) {
    const lotes: Record<string, unknown>[][] = []
    for (let i = 0; i < rows.length; i += BATCH_SIZE) lotes.push(rows.slice(i, i + BATCH_SIZE))
    const totalBatches = lotes.length
    let importacaoId: string | null = null
    let limpeza = 'nenhuma'
    let completados = 0

    setLog(prev => [...prev,
      `${rows.length.toLocaleString('pt-BR')} linhas — ${totalBatches} lote${totalBatches > 1 ? 's' : ''} (${BATCH_SIZE}/lote, até ${CONCURRENCY} paralelos)`,
    ])
    setProgress({ current: 0, total: totalBatches })

    async function enviarLote(
      loteDados: Record<string, unknown>[],
      batchNum: number,
      impId: string | null,
      periodos?: string[],
    ): Promise<Record<string, unknown>> {
      const res = await fetch('/api/importar', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rows: loteDados,
          meta: {
            filename:     arquivo!.name,
            batchNum,
            totalBatches,
            totalLinhas:  rows.length,
            importacaoId: impId,
            ...(periodos !== undefined ? { periodosNoArquivo: periodos } : {}),
          },
        }),
      })

      let data: Record<string, unknown>
      try { data = await res.json() }
      catch { throw new Error(`Lote ${batchNum}: resposta inválida (HTTP ${res.status})`) }

      if (!res.ok || !data.ok)
        throw new Error(`Lote ${batchNum}: ${(data.error as string) ?? 'Falha desconhecida'}`)

      if (data.insertError) setLog(prev => [...prev, `⚠ ${data.insertError}`])

      for (const [k, v] of Object.entries((data.statusCount as Record<string, number>) ?? {})) {
        statusAcum.current[k] = (statusAcum.current[k] ?? 0) + (v as number)
      }

      completados++
      setProgress({ current: completados, total: totalBatches })
      return data
    }

    const r1 = await enviarLote(lotes[0], 1, null, periodosNoArquivo)
    importacaoId = r1.importacaoId as string
    limpeza      = (r1.limpeza as string) ?? 'nenhuma'

    for (let i = 1; i < totalBatches - 1; i += CONCURRENCY) {
      await Promise.all(
        lotes.slice(i, i + CONCURRENCY).map((lote, j) => enviarLote(lote, i + j + 1, importacaoId))
      )
    }

    if (totalBatches > 1) {
      await enviarLote(lotes[totalBatches - 1], totalBatches, importacaoId)
    }

    const resumoStatus = Object.entries(statusAcum.current)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k}: ${v}`)
      .join(' | ')

    setStatus('success')
    setProgress(null)
    setLog(prev => [
      ...prev,
      limpeza === 'total'   ? '⚠ CDD diferente — base anterior removida.'  : '',
      limpeza === 'periodo' ? '⚠ Dados anteriores do período substituídos.' : '',
      `✓ ${rows.length.toLocaleString('pt-BR')} linhas importadas com sucesso.`,
      `Status no arquivo: ${resumoStatus}`,
    ].filter(Boolean))
  }

  async function handleImport() {
    if (!arquivo) return
    setConfirmCDD(null)
    setStatus('loading')
    setLog(['Lendo arquivo... aguarde, processando em background'])
    setProgress(null)
    statusAcum.current = {}
    parsedRowsRef.current = null

    try {
      const buffer = await arquivo.arrayBuffer()
      const { rows, headers } = await new Promise<{
        rows: Record<string, unknown>[]
        headers: string[]
      }>((resolve, reject) => {
        const worker = new Worker('/xlsx-worker.js')
        const timeout = setTimeout(() => {
          worker.terminate()
          reject(new Error('Tempo limite excedido ao processar o arquivo (>90s). Tente um arquivo menor.'))
        }, 90_000)
        worker.onmessage = (e) => {
          clearTimeout(timeout)
          worker.terminate()
          if (e.data.success) resolve({ rows: e.data.rows, headers: e.data.headers ?? [] })
          else reject(new Error(e.data.error))
        }
        worker.onerror = (e) => {
          clearTimeout(timeout)
          worker.terminate()
          reject(new Error(e.message || 'Erro ao processar arquivo'))
        }
        worker.postMessage({ buffer }, [buffer])
      })

      const temReattempt = headers.includes('reattempt')
      if (!temReattempt) {
        const similar = headers.filter(h => h.toLowerCase().includes('reattempt') || h.toLowerCase().includes('reatt'))
        setLog(prev => [...prev,
          `⚠ Coluna 'reattempt' não encontrada. Colunas similares: ${similar.join(', ') || 'nenhuma'}`,
          `Primeiras colunas (1-10): ${headers.slice(0, 10).join(', ')}`,
          `Coluna 42: ${headers[41] ?? '—'}`,
        ])
      } else {
        setLog(prev => [...prev, `✓ Coluna 'reattempt' encontrada (posição ${headers.indexOf('reattempt') + 1})`])
      }

      if (!rows.length) {
        setStatus('error')
        setLog(['Arquivo vazio.'])
        return
      }

      const ausentes = COLUNAS_OBRIGATORIAS.filter(c => !(c in rows[0]))
      if (ausentes.length) {
        setStatus('error')
        setLog([`Colunas ausentes: ${ausentes.join(', ')}`])
        return
      }

      function getPeriodo(val: unknown): string | null {
        if (!val) return null
        if (val instanceof Date) {
          if (isNaN(val.getTime())) return null
          return `${val.getFullYear()}-${String(val.getMonth() + 1).padStart(2, '0')}`
        }
        if (typeof val === 'number') {
          const d = new Date(Math.round((val - 25569) * 86400 * 1000))
          return isNaN(d.getTime()) ? null : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        }
        const d = new Date(val as string)
        return isNaN(d.getTime()) ? null : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      }

      const periodosNoArquivo = [
        ...new Set(rows.map(r => getPeriodo(r.tour_date)).filter(Boolean))
      ].sort() as string[]

      setLog(prev => [...prev, `Períodos detectados no arquivo: ${periodosNoArquivo.join(', ')}`])

      // Checar CDD existente antes de enviar lotes
      const novoCDD = String(rows[0].distribution_center_id ?? '')
      const supabase = createClient()
      const { data: imports } = await supabase.from('importacoes').select('cdd').limit(1)
      const cddAtual = imports?.[0]?.cdd ?? null

      if (cddAtual && cddAtual !== novoCDD) {
        parsedRowsRef.current = rows
        parsedPeriodosRef.current = periodosNoArquivo
        setConfirmCDD({ atual: cddAtual, novo: novoCDD })
        setStatus('idle')
        return
      }

      await sendBatches(rows, periodosNoArquivo)

    } catch (err) {
      setStatus('error')
      setLog(prev => [...prev, `Erro: ${err instanceof Error ? err.message : 'Falha inesperada'}`])
    }
  }

  async function confirmarImport() {
    const rows = parsedRowsRef.current
    const periodos = parsedPeriodosRef.current
    if (!rows) return
    setConfirmCDD(null)
    setStatus('loading')
    statusAcum.current = {}
    try {
      await sendBatches(rows, periodos)
    } catch (err) {
      setStatus('error')
      setLog(prev => [...prev, `Erro: ${err instanceof Error ? err.message : 'Falha inesperada'}`])
    }
  }

  function resetar() {
    setArquivo(null)
    setStatus('idle')
    setLog([])
    setProgress(null)
    setConfirmCDD(null)
    parsedRowsRef.current = null
  }

  return (
    <div className="flex-1 flex flex-col gap-5 px-6 py-6 overflow-y-auto">
      <p className="text-gray-500 text-xs">
        Planilha de rotas exportada do sistema operacional. Formatos: .xlsx, .csv
      </p>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-3 cursor-pointer transition-all',
          dragging
            ? 'border-[#F2C800] bg-[#FFF8DC]'
            : 'border-gray-200 hover:border-[#F2C800]/60 hover:bg-[#FFF8DC]/40'
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.csv"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
        <FileSpreadsheet size={32} className="text-[#F2C800]" />
        <div className="text-center">
          <p className="text-sm text-gray-600">
            {arquivo ? arquivo.name : 'Arraste o arquivo ou clique para selecionar'}
          </p>
          {arquivo && (
            <p className="text-xs text-gray-400 mt-1">
              {(arquivo.size / 1024).toFixed(0)} KB
            </p>
          )}
        </div>
      </div>

      {/* Barra de progresso */}
      {progress && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-gray-500">
            <span>Enviando lote {progress.current} de {progress.total}...</span>
            <span className="font-medium text-[#003087]">
              {Math.round((progress.current / progress.total) * 100)}%
            </span>
          </div>
          <div className="bg-gray-100 rounded-full h-2 overflow-hidden">
            <div
              className="h-full bg-[#F2C800] rounded-full transition-all duration-300"
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Log */}
      {log.length > 0 && (
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 space-y-1">
          {log.map((l, i) => (
            <p key={i} className="text-xs font-mono text-gray-600">{l}</p>
          ))}
        </div>
      )}

      {/* Confirmação de troca de CDD */}
      {confirmCDD && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
          <div className="flex items-start gap-2">
            <AlertTriangle size={15} className="text-amber-600 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-amber-800">CDD diferente detectado</p>
              <p className="text-xs text-amber-700">
                Base atual: <strong>{confirmCDD.atual}</strong> → Arquivo: <strong>{confirmCDD.novo}</strong>
              </p>
              <p className="text-xs text-amber-700">
                Todos os dados anteriores serão removidos e substituídos pelos do novo arquivo.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { setConfirmCDD(null); setLog([]) }}
              className="flex-1 h-9 rounded-lg border border-amber-300 text-amber-700 text-xs font-medium hover:bg-amber-100 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={confirmarImport}
              className="flex-1 h-9 rounded-lg bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 transition-colors"
            >
              Confirmar importação
            </button>
          </div>
        </div>
      )}

      {status === 'success' && (
        <div className="flex items-center gap-2 text-[#10B981] text-sm">
          <CheckCircle2 size={16} /> Importado com sucesso
        </div>
      )}
      {status === 'error' && (
        <div className="flex items-center gap-2 text-[#EF4444] text-sm">
          <XCircle size={16} /> Verifique os erros acima
        </div>
      )}

      <div className="flex gap-3 mt-auto pt-4 border-t border-gray-100">
        <button
          onClick={resetar}
          className="flex-1 h-11 rounded-lg border border-gray-200 text-gray-500 text-sm hover:border-gray-300 hover:text-[#111111] transition-all"
        >
          Limpar
        </button>
        <button
          onClick={handleImport}
          disabled={!arquivo || status === 'loading' || !!confirmCDD}
          className={cn(
            'flex-1 h-11 rounded-lg font-semibold text-sm text-[#003087] transition-all flex items-center justify-center gap-2',
            'bg-[#F2C800] hover:bg-[#D4A800]',
            'disabled:opacity-40 disabled:cursor-not-allowed'
          )}
        >
          {status === 'loading' && <Loader2 size={14} className="animate-spin" />}
          {status === 'loading' ? 'Processando...' : 'Importar'}
        </button>
      </div>
    </div>
  )
}

// ─── Aba Motoristas — FormData simples (CSV é pequeno) ───────────────────────

function ImportTabMotoristas() {
  const [status,   setStatus]   = useState<Status>('idle')
  const [arquivo,  setArquivo]  = useState<File | null>(null)
  const [log,      setLog]      = useState<string[]>([])
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFile(file: File) {
    if (!file.name.match(/\.csv$/i)) {
      setLog(['Arquivo inválido. Use: .csv'])
      setStatus('error')
      return
    }
    setArquivo(file)
    setStatus('idle')
    setLog([])
  }

  async function handleImport() {
    if (!arquivo) return
    setStatus('loading')
    setLog(['Enviando arquivo para o servidor...'])

    try {
      const form = new FormData()
      form.append('file', arquivo)

      const res  = await fetch('/api/importar-motoristas', { method: 'POST', body: form })
      const data = await res.json()

      if (!res.ok || !data.ok) {
        setStatus('error')
        setLog(prev => [...prev, `Erro: ${data.error ?? 'Falha desconhecida'}`])
        return
      }

      setStatus('success')
      setLog(prev => [
        ...prev,
        `✓ ${data.inseridos} novos motoristas inseridos.`,
        `✓ ${data.atualizados} motoristas atualizados.`,
        data.historico_preservado > 0
          ? `${data.historico_preservado} motoristas anteriores preservados no histórico.`
          : '',
      ].filter(Boolean))
    } catch {
      setStatus('error')
      setLog(prev => [...prev, 'Erro de conexão com o servidor.'])
    }
  }

  function resetar() {
    setArquivo(null)
    setStatus('idle')
    setLog([])
  }

  return (
    <div className="flex-1 flex flex-col gap-5 px-6 py-6 overflow-y-auto">
      <p className="text-gray-500 text-xs">
        Arquivo CSV com colunas: codigo (ou driver_external_id) e nome. Formato: .csv
      </p>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-3 cursor-pointer transition-all',
          dragging
            ? 'border-[#F2C800] bg-[#FFF8DC]'
            : 'border-gray-200 hover:border-[#F2C800]/60 hover:bg-[#FFF8DC]/40'
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
        <FileSpreadsheet size={32} className="text-[#F2C800]" />
        <div className="text-center">
          <p className="text-sm text-gray-600">
            {arquivo ? arquivo.name : 'Arraste o arquivo ou clique para selecionar'}
          </p>
          {arquivo && (
            <p className="text-xs text-gray-400 mt-1">{(arquivo.size / 1024).toFixed(0)} KB</p>
          )}
        </div>
      </div>

      {log.length > 0 && (
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 space-y-1">
          {log.map((l, i) => (
            <p key={i} className="text-xs font-mono text-gray-600">{l}</p>
          ))}
        </div>
      )}

      {status === 'success' && (
        <div className="flex items-center gap-2 text-[#10B981] text-sm">
          <CheckCircle2 size={16} /> Importado com sucesso
        </div>
      )}
      {status === 'error' && (
        <div className="flex items-center gap-2 text-[#EF4444] text-sm">
          <XCircle size={16} /> Verifique os erros acima
        </div>
      )}

      <div className="flex gap-3 mt-auto pt-4 border-t border-gray-100">
        <button
          onClick={resetar}
          className="flex-1 h-11 rounded-lg border border-gray-200 text-gray-500 text-sm hover:border-gray-300 hover:text-[#111111] transition-all"
        >
          Limpar
        </button>
        <button
          onClick={handleImport}
          disabled={!arquivo || status === 'loading'}
          className={cn(
            'flex-1 h-11 rounded-lg font-semibold text-sm text-[#003087] transition-all flex items-center justify-center gap-2',
            'bg-[#F2C800] hover:bg-[#D4A800]',
            'disabled:opacity-40 disabled:cursor-not-allowed'
          )}
        >
          {status === 'loading' && <Loader2 size={14} className="animate-spin" />}
          {status === 'loading' ? 'Processando...' : 'Importar'}
        </button>
      </div>
    </div>
  )
}

// ─── Drawer principal ─────────────────────────────────────────────────────────

export function ImportDrawer({ open, onOpenChange }: ImportDrawerProps) {
  const [aba, setAba] = useState<Aba>('devolucoes')

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full max-w-[440px] bg-white border-l border-gray-100 text-[#111111] p-0 flex flex-col"
      >
        <SheetHeader className="px-6 pt-6 pb-0 border-b border-gray-100">
          <SheetTitle className="text-[#003087] font-bold flex items-center gap-2 mb-4">
            <Upload size={18} className="text-[#F2C800]" />
            Importação
          </SheetTitle>

          <div className="flex gap-1 pb-0">
            {([
              { key: 'devolucoes', label: 'Devoluções', icon: FileSpreadsheet },
              { key: 'motoristas', label: 'Motoristas', icon: Users           },
            ] as { key: Aba; label: string; icon: React.ElementType }[]).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setAba(key)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all',
                  aba === key
                    ? 'border-[#F2C800] text-[#003087]'
                    : 'border-transparent text-gray-400 hover:text-gray-600'
                )}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>
        </SheetHeader>

        {aba === 'devolucoes'
          ? <ImportTabDevolucoes key="devolucoes" />
          : <ImportTabMotoristas key="motoristas" />
        }
      </SheetContent>
    </Sheet>
  )
}
