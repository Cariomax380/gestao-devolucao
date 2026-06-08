'use server'

import { createClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'

export async function criarAcao(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await supabase.from('plano_acao').insert({
    descricao:           formData.get('descricao') as string,
    responsavel:         formData.get('responsavel') as string || null,
    prazo:               formData.get('prazo') as string || null,
    status:              formData.get('status') as string || 'aberto',
    prioridade:          formData.get('prioridade') as string || 'media',
    indicador_impactado: formData.get('indicador_impactado') as string || null,
    comentarios:         formData.get('comentarios') as string || null,
    criado_por:          user?.email ?? null,
    user_id:             user?.id ?? null,
  })

  if (error) return { error: error.message }
  revalidatePath('/plano-acao')
  return { ok: true }
}

export async function editarAcao(id: string, formData: FormData) {
  const supabase = await createClient()

  const { error } = await supabase.from('plano_acao').update({
    descricao:           formData.get('descricao') as string,
    responsavel:         formData.get('responsavel') as string || null,
    prazo:               formData.get('prazo') as string || null,
    status:              formData.get('status') as string,
    prioridade:          formData.get('prioridade') as string,
    indicador_impactado: formData.get('indicador_impactado') as string || null,
    comentarios:         formData.get('comentarios') as string || null,
    atualizado_em:       new Date().toISOString(),
  }).eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/plano-acao')
  return { ok: true }
}

export async function excluirAcao(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('plano_acao').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/plano-acao')
  return { ok: true }
}
