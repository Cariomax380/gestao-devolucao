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

function ImportTab({
  endpoint,
  accept,
  hint,
}: {
  endpoint: string
  accept: string
  hint: string
}) {
  const [status, setStatus] = useState<Status>('idle')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [log, setLog] = useState<string[]>([])
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFile(file: File) {
    const exts = accept.split(',').map(e => e.trim().replace('.', '')).join('|')
    const regex = new RegExp(`\\.(${exts})$`, 'i')
    if (!file.name.match(regex)) {
      setLog([`Arquivo inválido. Use: ${accept}`])
      setStatus('error')
      return
    }
    setArquivo(file)
    setStatus('idle')
    setLog([])
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  async function handleImport() {
    if (!arquivo) return
    setStatus('loading')
    setLog(['Enviando arquivo para o servidor...'])

    try {
      const form = new FormData()
      form.append('file', arquivo)

      const res = await fetch(endpoint, { method: 'POST', body: form })
      const data = await res.json()

      if (!res.ok || !data.ok) {
        setStatus('error')
        setLog((prev) => [...prev, `Erro: ${data.error ?? 'Falha desconhecida'}`])
        return
      }

      setStatus('success')

      if (endpoint === '/api/importar') {
        setLog((prev) => [
          ...prev,
          data.limpeza === 'total'   ? '⚠ CDD diferente — base anterior removida.' :
          data.limpeza === 'periodo' ? `⚠ Dados anteriores do período substituídos.` : '',
          `✓ ${data.total.toLocaleString('pt-BR')} linhas importadas.`,
          data.erros > 0 ? `⚠ ${data.erros} linhas com erro.` : '✓ Sem erros.',
        ].filter(Boolean))
      } else {
        setLog((prev) => [
          ...prev,
          `✓ ${data.inseridos} novos motoristas inseridos.`,
          `✓ ${data.atualizados} motoristas atualizados.`,
          data.historico_preservado > 0
            ? `📁 ${data.historico_preservado} motoristas anteriores preservados no histórico.`
            : '',
        ].filter(Boolean))
      }
    } catch {
      setStatus('error')
      setLog((prev) => [...prev, 'Erro de conexão com o servidor.'])
    }
  }

  function resetar() {
    setArquivo(null)
    setStatus('idle')
    setLog([])
  }

  return (
    <div className="flex-1 flex flex-col gap-6 px-6 py-6 overflow-y-auto">
      <p className="text-gray-500 text-xs">{hint}</p>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-3 cursor-pointer transition-all',
          dragging
            ? 'border-[#C9A84C] bg-[#C9A84C]/5'
            : 'border-white/10 hover:border-[#C9A84C]/40 hover:bg-white/[0.02]'
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
        <FileSpreadsheet size={32} className="text-[#C9A84C]/60" />
        <div className="text-center">
          <p className="text-sm text-gray-300">
            {arquivo ? arquivo.name : 'Arraste o arquivo ou clique para selecionar'}
          </p>
          {arquivo && (
            <p className="text-xs text-gray-600 mt-1">
              {(arquivo.size / 1024).toFixed(0)} KB
            </p>
          )}
        </div>
      </div>

      {/* Log */}
      {log.length > 0 && (
        <div className="bg-black/40 rounded-xl p-4 border border-white/5 space-y-1">
          {log.map((l, i) => (
            <p key={i} className="text-xs font-mono text-gray-400">{l}</p>
          ))}
        </div>
      )}

      {status === 'success' && (
        <div className="flex items-center gap-2 text-green-400 text-sm">
          <CheckCircle2 size={16} /> Importado com sucesso
        </div>
      )}
      {status === 'error' && (
        <div className="flex items-center gap-2 text-red-400 text-sm">
          <XCircle size={16} /> Verifique os erros acima
        </div>
      )}

      <div className="flex gap-3 mt-auto pt-4 border-t border-white/5">
        <button
          onClick={resetar}
          className="flex-1 h-11 rounded-xl border border-white/10 text-gray-400 text-sm hover:border-white/20 hover:text-white transition-all"
        >
          Limpar
        </button>
        <button
          onClick={handleImport}
          disabled={!arquivo || status === 'loading'}
          className={cn(
            'flex-1 h-11 rounded-xl font-semibold text-sm text-black transition-all flex items-center justify-center gap-2',
            'bg-gradient-to-r from-[#C9A84C] to-[#E8C96A]',
            'hover:from-[#B8962A] hover:to-[#D4B055]',
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

export function ImportDrawer({ open, onOpenChange }: ImportDrawerProps) {
  const [aba, setAba] = useState<Aba>('devolucoes')

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[440px] bg-[#0D0D0D] border-l border-white/5 text-white p-0 flex flex-col"
      >
        <SheetHeader className="px-6 pt-6 pb-0 border-b border-white/5">
          <SheetTitle className="text-white font-bold flex items-center gap-2 mb-4">
            <Upload size={18} className="text-[#C9A84C]" />
            Importação
          </SheetTitle>

          {/* Abas */}
          <div className="flex gap-1 pb-0">
            {([
              { key: 'devolucoes', label: 'Devoluções',  icon: FileSpreadsheet },
              { key: 'motoristas', label: 'Motoristas',  icon: Users },
            ] as { key: Aba; label: string; icon: React.ElementType }[]).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setAba(key)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all',
                  aba === key
                    ? 'border-[#C9A84C] text-[#C9A84C]'
                    : 'border-transparent text-gray-500 hover:text-gray-300'
                )}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>
        </SheetHeader>

        {aba === 'devolucoes' ? (
          <ImportTab
            key="devolucoes"
            endpoint="/api/importar"
            accept=".xlsx,.csv"
            hint="Planilha de rotas exportada do sistema operacional. Formatos: .xlsx, .csv"
          />
        ) : (
          <ImportTab
            key="motoristas"
            endpoint="/api/importar-motoristas"
            accept=".csv"
            hint="Arquivo CSV com colunas: codigo (ou driver_external_id) e nome. Formato: .csv"
          />
        )}
      </SheetContent>
    </Sheet>
  )
}
