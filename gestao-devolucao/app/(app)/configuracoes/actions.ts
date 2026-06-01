'use server'

import { createClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'

export async function salvarMetas(formData: FormData) {
  const supabase = await createClient()

  const periodo = (formData.get('periodo') as string) || 'global'

  const indicadores = [
    'devolucao_pdv_pct',
    'devolucao_hl_pct',
    'reversao_pct',
    'repasses_apontados_pct',
    'repasses_efetivos_pct',
    'devolucoes_apontadas_pct',
    'aderencia_raio_pct',
    'devolucao_antes_horario_pct',
    'tempo_medio_cme',
    'tempo_medio_tratativa',
  ]

  const upserts = indicadores
    .map(ind => {
      const raw = formData.get(ind)
      if (raw === null || raw === '') return null
      const valor = parseFloat(raw as string)
      if (isNaN(valor)) return null
      return { indicador: ind, valor_meta: valor, cdd: '*', periodo }
    })
    .filter(Boolean)

  if (upserts.length === 0) return { error: 'Nenhum valor válido informado.' }

  const { error } = await supabase
    .from('metas')
    .upsert(upserts, { onConflict: 'indicador,cdd,periodo' })

  if (error) return { error: error.message }

  revalidatePath('/configuracoes')
  return { ok: true }
}
