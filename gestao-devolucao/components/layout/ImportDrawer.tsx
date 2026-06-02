'use client'

import { useState, useRef } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Upload, FileSpreadsheet, CheckCircle2, XCircle, Loader2, Users } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ImportDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type Status = 'idle' | 'loading' | 'success' | 'error'
type Aba = 'devolucoes' | 'motoristas'

const BATCH_SIZE = 500
const COLUNAS_OBRIGATORIAS = [
  'distribution_center_id', 'tour_date', 'driver_external_id', 'poc_external_id', 'status',
]

// ─── Aba Devoluções — parse no client + envio em lotes ───────────────────────

function ImportTabDevolucoes() {
  const [status,   setStatus]   = useState<Status>('idle')
  const [arquivo,  setArquivo]  = useState<File | null>(null)
  const [log,      setLog]      = useState<string[]>([])
  const [dragging, setDragging] = useState(false)
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null)
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
  }

  async function handleImport() {
    if (!arquivo) return
    setStatus('loading')
    setLog(['Lendo arquivo...'])
    setProgress(null)

    try {
      // 1. Parse XLSX no browser
      const XLSX = await import('xlsx')
      const buffer = await arquivo.arrayBuffer()
      const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null })

      if (!rows.length) {
        setStatus('error')
        setLog(['Arquivo vazio.'])
        return
      }

      // 2. Validar colunas no client (feedback rápido antes de enviar)
      const ausentes = COLUNAS_OBRIGATORIAS.filter(c => !(c in rows[0]))
      if (ausentes.length) {
        setStatus('error')
        setLog([`Colunas ausentes: ${ausentes.join(', ')}`])
        return
      }

      // 3. Enviar em lotes
      const totalBatches = Math.ceil(rows.length / BATCH_SIZE)
      let importacaoId: string | null = null
      let limpeza = 'nenhuma'

      setLog([`${rows.length.toLocaleString('pt-BR')} linhas encontradas. Enviando em ${totalBatches} lote${totalBatches > 1 ? 's' : ''}...`])

      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batchNum = Math.floor(i / BATCH_SIZE) + 1
        setProgress({ current: batchNum, total: totalBatches })

        const res = await fetch('/api/importar', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rows: rows.slice(i, i + BATCH_SIZE),
            meta: {
              filename:    arquivo.name,
              batchNum,
              totalBatches,
              totalLinhas: rows.length,
              importacaoId,
            },
          }),
        })

        const data = await res.json()

        if (!res.ok || !data.ok) {
          setStatus('error')
          setLog(prev => [...prev, `Erro no lote ${batchNum}: ${data.error ?? 'Falha desconhecida'}`])
          return
        }

        importacaoId = data.importacaoId
        if (batchNum === 1) limpeza = data.limpeza ?? 'nenhuma'
      }

      setStatus('success')
      setProgress(null)
      setLog([
        limpeza === 'total'   ? '⚠ CDD diferente — base anterior removida.'         : '',
        limpeza === 'periodo' ? '⚠ Dados anteriores do período substituídos.'        : '',
        `✓ ${rows.length.toLocaleString('pt-BR')} linhas importadas com sucesso.`,
      ].filter(Boolean))

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
        className="w-[440px] bg-white border-l border-gray-100 text-[#111111] p-0 flex flex-col"
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
