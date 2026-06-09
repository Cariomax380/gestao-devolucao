'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase-server'

export interface RelatoInput {
  motorista:   string
  data_rota:   string
  tipo:        'total' | 'fechado' | 'geral'
  devs_dia:    number
  limiar:      number
  relato:      string
  responsavel?: string
  status:      'relatado' | 'em_acompanhamento' | 'concluido'
  gerarAcao:   boolean
  cincoP?:     string[]   // respostas preenchidas dos 5 porquês (array de até 5)
  categoria?:  'operacional' | 'comercial' | 'externo' | 'sistemico'
}

export async function criarRelato(input: RelatoInput): Promise<{ error?: string; ok?: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autorizado' }

  // Valida campos obrigatórios
  // Para tipo 'geral', motorista pode ser string vazia (identifica nível de frota)
  const motoristaObrigatorio = input.tipo !== 'geral'
  if ((motoristaObrigatorio && !input.motorista) || !input.data_rota || !input.relato.trim()) {
    return { error: 'Campos obrigatórios ausentes (motorista para tipo motorista, data_rota, relato)' }
  }
  if (!['total', 'fechado', 'geral'].includes(input.tipo)) {
    return { error: 'Tipo inválido' }
  }
  if (!['relatado', 'em_acompanhamento', 'concluido'].includes(input.status)) {
    return { error: 'Status inválido' }
  }

  // Filtra respostas preenchidas; salva null se nenhuma
  const cincoPFiltered = input.cincoP?.filter(s => s.trim())
  const cincoPValue = cincoPFiltered?.length ? cincoPFiltered : null

  const { error: insErr } = await supabase.from('gatilho_relato').insert({
    user_id:       user.id,
    motorista:     input.motorista,
    data_rota:     input.data_rota,
    tipo:          input.tipo,
    devs_dia:      input.devs_dia,
    limiar:        input.limiar,
    relato:        input.relato.trim(),
    responsavel:   input.responsavel?.trim() || null,
    status:        input.status,
    cinco_porques: cincoPValue,
    categoria:     input.categoria ?? null,
  })

  if (insErr) return { error: insErr.message }

  // Gera item no plano de ação (opcional)
  if (input.gerarAcao) {
    const descricao = input.tipo === 'geral'
      ? `Estouro de gatilho geral (frota) em ${input.data_rota}: ${input.relato.trim()}`
      : `Estouro de gatilho em ${input.data_rota} — motorista ${input.motorista}: ${input.relato.trim()}`

    const gatilhoContexto = {
      motorista:     input.motorista,
      data_rota:     input.data_rota,
      tipo:          input.tipo,
      devs_dia:      input.devs_dia,
      limiar:        input.limiar,
      relato:        input.relato.trim(),
      responsavel:   input.responsavel?.trim() || null,
      ...(cincoPFiltered?.length ? { cinco_porques: cincoPFiltered } : {}),
      ...(input.categoria          ? { categoria:    input.categoria  } : {}),
    }

    await supabase.from('plano_acao').insert({
      descricao,
      responsavel:         input.responsavel?.trim() || 'Supervisor',
      prazo:               new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10),
      status:              'aberto',
      prioridade:          'alta',
      indicador_impactado: 'devolucao_pdv',
      criado_por:          user.id,
      user_id:             user.id,
      gatilho_contexto:    gatilhoContexto,
    })
  }

  revalidatePath('/gatilho')
  return { ok: true }
}

export interface EditarRelatoInput {
  id:          string
  relato:      string
  responsavel?: string
  status:      'relatado' | 'em_acompanhamento' | 'concluido'
  cincoP?:     string[]
  categoria?:  'operacional' | 'comercial' | 'externo' | 'sistemico'
}

export async function editarRelato(input: EditarRelatoInput): Promise<{ error?: string; ok?: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autorizado' }

  if (!input.relato.trim()) return { error: 'Relato é obrigatório' }
  if (!['relatado', 'em_acompanhamento', 'concluido'].includes(input.status)) {
    return { error: 'Status inválido' }
  }

  const cincoPFiltered = input.cincoP?.filter(s => s.trim())
  const cincoPValue = cincoPFiltered?.length ? cincoPFiltered : null

  const { error } = await supabase
    .from('gatilho_relato')
    .update({
      relato:        input.relato.trim(),
      responsavel:   input.responsavel?.trim() || null,
      status:        input.status,
      cinco_porques: cincoPValue,
      categoria:     input.categoria ?? null,
    })
    .eq('id', input.id)
    .eq('user_id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/gatilho')
  return { ok: true }
}

export async function resetarRelato(id: string): Promise<{ error?: string; ok?: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autorizado' }

  const { error } = await supabase
    .from('gatilho_relato')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/gatilho')
  return { ok: true }
}
