import * as XLSX from 'xlsx'

self.onmessage = function (e: MessageEvent) {
  const { buffer } = e.data as { buffer: ArrayBuffer }
  try {
    const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true })
    if (!wb.SheetNames.length) throw new Error('Arquivo sem planilhas válidas')
    const ws = wb.Sheets[wb.SheetNames[0]]
    if (!ws) throw new Error('Planilha não encontrada no arquivo')
    const rows = XLSX.utils.sheet_to_json(ws, { defval: null }) as Record<string, unknown>[]
    const headers = rows.length > 0 ? Object.keys(rows[0]) : []
    self.postMessage({ success: true, rows, headers })
  } catch (err) {
    self.postMessage({ success: false, error: (err as Error).message })
  }
}
