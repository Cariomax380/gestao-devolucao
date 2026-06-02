'use client'

import { useState } from 'react'
import { login } from '@/app/auth/actions'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function LoginPage() {
  const [erro, setErro] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setErro(null)
    const formData = new FormData(e.currentTarget)
    const result = await login(formData)
    if (result?.error) {
      setErro(result.error)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-[#FAFAFA]">
      {/* Painel esquerdo — formulário */}
      <div className="flex flex-col justify-center px-12 w-full max-w-md bg-white border-r border-gray-100">
        {/* Logo */}
        <div className="mb-12">
          <span className="text-3xl font-black tracking-widest text-[#003087]">Devolução Maceió</span>
          <span className="text-3xl font-black tracking-widest text-[#F2C800]">.</span>
        </div>

        <h1 className="text-3xl font-bold text-[#003087] mb-2">
          Faça seu <span className="text-[#F2C800]">Login</span>.
        </h1>
        <p className="text-gray-500 text-sm mb-10">
          Gestão de Devolução — CDD Maceió
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-gray-600 text-sm font-medium">
              Email
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="bg-white border-gray-200 text-[#111111] placeholder:text-gray-400 focus:border-[#F2C800] focus:ring-[#F2C800]/20 rounded-lg h-11"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-gray-600 text-sm font-medium">
              Senha
            </Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="bg-white border-gray-200 text-[#111111] placeholder:text-gray-400 focus:border-[#F2C800] focus:ring-[#F2C800]/20 rounded-lg h-11"
            />
          </div>

          {erro && (
            <p className="text-sm text-[#EF4444] text-center">{erro}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 rounded-lg font-semibold text-[#003087] bg-[#F2C800] hover:bg-[#D4A800] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <p className="mt-12 text-xs text-gray-400 text-center">
          {new Date().getFullYear()} · GD Gestão de Devolução
        </p>
      </div>

      {/* Painel direito — visual Ambev */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden items-end bg-[#003087]">
        {/* Círculo decorativo */}
        <div className="absolute top-1/4 right-1/4 w-96 h-96 rounded-full bg-[#F2C800]/10 blur-3xl" />
        <div className="absolute bottom-1/3 right-1/3 w-64 h-64 rounded-full bg-[#F2C800]/5 blur-2xl" />

        {/* Texto decorativo */}
        <div className="relative z-10 p-16 w-full">
          <div className="border-l-2 border-[#F2C800]/50 pl-6 mb-8">
            <p className="text-white/80 text-lg font-light leading-relaxed">
              Monitore devoluções,<br />
              identifique ofensores<br />
              e tome ação em tempo real.
            </p>
          </div>

          <div className="flex gap-8">
            {[
              { label: 'Rotas monitoradas', value: '355+' },
              { label: 'PDVs atendidos',    value: '6.4k+' },
              { label: 'Motivos mapeados',  value: '12' },
            ].map((m) => (
              <div key={m.label}>
                <div className="text-2xl font-bold text-[#F2C800]">{m.value}</div>
                <div className="text-xs text-white/50 mt-1">{m.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
