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
    <div className="min-h-screen flex bg-black">
      {/* Painel esquerdo — formulário */}
      <div className="flex flex-col justify-center px-12 w-full max-w-md">
        {/* Logo */}
        <div className="mb-12">
          <span className="text-3xl font-black tracking-widest text-white">Devolução Maceió</span>
          <span className="text-3xl font-black tracking-widest text-[#C9A84C]">.</span>
        </div>

        <h1 className="text-4xl font-bold text-white mb-2">
          Faça seu <span className="text-[#C9A84C]">Login</span>.
        </h1>
        <p className="text-gray-400 text-sm mb-10">
          Devolução Maceió
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-gray-300 text-sm">
              Email
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus:border-[#C9A84C] focus:ring-[#C9A84C]/20 rounded-xl h-12"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-gray-300 text-sm">
              Senha
            </Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus:border-[#C9A84C] focus:ring-[#C9A84C]/20 rounded-xl h-12"
            />
          </div>

          {erro && (
            <p className="text-sm text-red-400 text-center">{erro}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-xl font-semibold text-black transition-all duration-200
              bg-gradient-to-r from-[#C9A84C] to-[#E8C96A]
              hover:from-[#B8962A] hover:to-[#D4B055]
              disabled:opacity-60 disabled:cursor-not-allowed
              shadow-lg shadow-[#C9A84C]/20"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <p className="mt-12 text-xs text-gray-600 text-center">
          {new Date().getFullYear()} · GD Gestão de Devolução
        </p>
      </div>

      {/* Painel direito — visual */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden items-end">
        {/* Gradiente de fundo */}
        <div className="absolute inset-0 bg-gradient-to-br from-black via-[#0d0d0d] to-[#1a1400]" />

        {/* Círculo dourado decorativo */}
        <div className="absolute top-1/4 right-1/4 w-96 h-96 rounded-full
          bg-[#C9A84C]/10 blur-3xl" />
        <div className="absolute bottom-1/3 right-1/3 w-64 h-64 rounded-full
          bg-[#C9A84C]/5 blur-2xl" />

        {/* Grid decorativo */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(#C9A84C 1px, transparent 1px),
              linear-gradient(90deg, #C9A84C 1px, transparent 1px)`,
            backgroundSize: '60px 60px'
          }}
        />

        {/* Texto decorativo */}
        <div className="relative z-10 p-16 w-full">
          <div className="border-l-2 border-[#C9A84C]/40 pl-6 mb-8">
            <p className="text-white/80 text-lg font-light leading-relaxed">
              Monitore devoluções,<br />
              identifique ofensores<br />
              e tome ação em tempo real.
            </p>
          </div>

          {/* Métricas decorativas */}
          <div className="flex gap-8">
            {[
              { label: 'Rotas monitoradas', value: '355+' },
              { label: 'PDVs atendidos', value: '6.4k+' },
              { label: 'Motivos mapeados', value: '12' },
            ].map((m) => (
              <div key={m.label}>
                <div className="text-2xl font-bold text-[#C9A84C]">{m.value}</div>
                <div className="text-xs text-gray-500 mt-1">{m.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
