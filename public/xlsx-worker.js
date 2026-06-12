// Web Worker para parse de XLSX sem bloquear o thread principal
// Usa o bundle local (sem CDN)
importScripts('/xlsx.full.min.js');

self.onmessage = function (e) {
  const { buffer } = e.data;
  try {
    const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    if (!wb.SheetNames.length) throw new Error('Arquivo sem planilhas válidas');
    const ws = wb.Sheets[wb.SheetNames[0]];
    if (!ws) throw new Error('Planilha não encontrada no arquivo');
    const rows = XLSX.utils.sheet_to_json(ws, { defval: null });

    // Diagnóstico: informa os headers da primeira linha para verificar nomes de colunas
    const headers = rows.length > 0 ? Object.keys(rows[0]) : [];

    self.postMessage({ success: true, rows, headers });
  } catch (err) {
    self.postMessage({ success: false, error: err.message });
  }
};
