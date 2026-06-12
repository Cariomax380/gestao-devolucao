'use client'

import { useState } from 'react'
import { convidarUsuario } from './actions'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface Usuario {
  id: string
  email: string
  created_at: string
  confirmado: boolean
}

interface Props {
  usuarios: Usuario[]
}

export function UsuariosSection({ usuarios }: Props) {
  const [mostrarForm, setMostrarForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState<string | null>(null)

  async function handleConvidar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setErro(null)
    setSucesso(null)
    const result = await convidarUsuario(new FormData(e.currentTarget))
    setLoading(false)
    if (result?.error) {
      setErro(result.error)
    } else {
      setSucesso('Convite enviado com sucesso.')
      setMostrarForm(false)
      ;(e.target as HTMLFormElement).reset()
    }
  }

  function formatarData(iso: string) {
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    })
  }

  return (
    <div className="px-6 py-5 space-y-5">
      {/* Ação: botão convidar */}
      {!mostrarForm && (
        <div className="flex justify-end">
          <button
            onClick={() => { setMostrarForm(true); setErro(null); setSucesso(null) }}
            className="flex items-center gap-1.5 text-sm font-medium text-[#003087] bg-[#F2C800] hover:bg-[#e8ba00] active:scale-[0.98] transition-all px-3 py-1.5 rounded-lg"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Convidar
          </button>
        </div>
      )}

      {/* Lista */}
      <div className="divide-y divide-gray-50">
        {usuarios.length === 0 && (
          <p className="py-4 text-sm text-gray-400 text-center">Nenhum usuário cadastrado.</p>
        )}
        {usuarios.map(u => (
          <div key={u.id} className="flex items-center justify-between py-3 first:pt-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#003087]/10 flex items-center justify-center text-[#003087] text-xs font-bold flex-shrink-0">
                {u.email[0].toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium text-[#111]">{u.email}</p>
                <p className="text-[11px] text-gray-400">Desde {formatarData(u.created_at)}</p>
              </div>
            </div>
            <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full flex-shrink-0 ${
              u.confirmado
                ? 'bg-green-50 text-green-600'
                : 'bg-amber-50 text-amber-600'
            }`}>
              {u.confirmado ? 'Ativo' : 'Pendente'}
            </span>
          </div>
        ))}
      </div>

      {/* Form de convite */}
      {mostrarForm && (
        <form onSubmit={handleConvidar} className="border-t border-gray-100 pt-5 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="invite-email" className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">
              Email do novo usuário
            </Label>
            <Input
              id="invite-email"
              name="email"
              type="email"
              required
              autoComplete="off"
              placeholder="usuario@email.com"
              className="bg-[#F9FAFB] border-gray-200 hover:border-gray-300 text-[#111] placeholder:text-gray-300 rounded-lg h-10 text-sm focus-visible:ring-0 focus-visible:border-[#F2C800] transition-colors"
            />
          </div>

          {erro && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
              <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-xs text-red-600 leading-snug">{erro}</p>
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="h-9 px-4 rounded-lg text-sm font-semibold text-[#003087] bg-[#F2C800] hover:bg-[#e8ba00] active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? 'Enviando…' : 'Enviar convite'}
            </button>
            <button
              type="button"
              onClick={() => { setMostrarForm(false); setErro(null) }}
              className="h-9 px-4 rounded-lg text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {sucesso && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3.5 py-3">
          <svg className="h-4 w-4 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <p className="text-sm text-green-700">{sucesso}</p>
        </div>
      )}
    </div>
  )
}
