'use client'

import { useSearchParams } from 'next/navigation'
import { FileDown } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

interface Props {
  collapsed: boolean
}

export function BotaoRelatorio({ collapsed }: Props) {
  const params  = useSearchParams()
  const [busy, setBusy] = useState(false)

  async function baixar() {
    if (busy) return
    setBusy(true)
    try {
      const periodo = params.get('periodo') ?? ''
      const url = `/api/relatorio-pdf${periodo ? `?periodo=${encodeURIComponent(periodo)}` : ''}`
      const res = await fetch(url)
      if (!res.ok) { console.error('Erro ao gerar relatório:', res.status); return }
      const blob = await res.blob()
      const href = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = href
      a.download = periodo ? `relatorio-${periodo}.pdf` : 'relatorio-geral.pdf'
      a.click()
      URL.revokeObjectURL(href)
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      onClick={baixar}
      disabled={busy}
      title={collapsed ? 'Relatório PDF' : undefined}
      className={cn(
        'flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-sm font-medium transition-all duration-150 w-[calc(100%-16px)]',
        busy
          ? 'text-[#F2C800]/50 cursor-wait'
          : 'text-white/70 hover:text-white hover:bg-white/10'
      )}
    >
      <FileDown size={18} className={cn('shrink-0', busy && 'animate-pulse')} />
      {!collapsed && (
        <span>{busy ? 'Gerando...' : 'Relatório PDF'}</span>
      )}
    </button>
  )
}
