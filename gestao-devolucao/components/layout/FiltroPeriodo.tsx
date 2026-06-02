'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useTransition, useState, useEffect } from 'react'

interface Props {
  periodos: { periodo: string }[]
}

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

const selectClass =
  'bg-white border border-gray-200 text-[#111111] text-sm rounded-lg px-3 py-1.5 focus:border-[#F2C800] focus:outline-none'

const selectIncClass =
  'bg-white border border-[#F2C800] text-[#111111] text-sm rounded-lg px-3 py-1.5 focus:border-[#D4A800] focus:outline-none'

export function FiltroPeriodo({ periodos }: Props) {
  const router   = useRouter()
  const pathname = usePathname()
  const params   = useSearchParams()
  const atual    = params.get('periodo') ?? ''
  const [, startTransition] = useTransition()

  const [anoUrl, mesUrl] = atual ? atual.split('-') : ['', '']

  // Estado local — segura seleção parcial sem depender da URL
  const [localMes, setLocalMes] = useState(mesUrl)
  const [localAno, setLocalAno] = useState(anoUrl)

  // Sincroniza com a URL quando muda externamente (ex: navegação back/forward ou limpar)
  useEffect(() => {
    setLocalMes(mesUrl)
    setLocalAno(anoUrl)
  }, [mesUrl, anoUrl])

  const anos = [...new Set(periodos.map(p => p.periodo.slice(0, 4)))].sort().reverse()

  function navigate(ano: string, mes: string) {
    const p = new URLSearchParams(params.toString())
    if (ano) {
      // ano + mes → período específico; só ano → acumulado do ano
      p.set('periodo', mes ? `${ano}-${mes}` : ano)
    } else {
      p.delete('periodo')
    }
    startTransition(() => {
      router.replace(`${pathname}?${p.toString()}`)
    })
  }

  function handleMes(mes: string) {
    setLocalMes(mes)
    if (localAno) navigate(localAno, mes)  // se ano preenchido, navega (com ou sem mês)
    else if (!mes) navigate('', '')         // limpou mês sem ano → limpa tudo
    // se só mês sem ano: aguarda o ano (não navega ainda)
  }

  function handleAno(ano: string) {
    setLocalAno(ano)
    navigate(ano, localMes)  // navega sempre: com mês (específico) ou sem (acumulado)
  }

  function limpar() {
    setLocalMes('')
    setLocalAno('')
    navigate('', '')
  }

  if (!periodos.length) return null

  // Hint apenas quando mês está selecionado mas ano não — ano sem mês é válido (acumulado)
  const incompleto = !!localMes && !localAno

  return (
    <div className="flex items-center gap-2">
      <div className="flex flex-col items-end gap-0.5">
        <div className="flex items-center gap-2">
          <select
            value={localMes}
            onChange={e => handleMes(e.target.value)}
            className={!localMes && localAno ? selectIncClass : selectClass}
          >
            <option value="">Mês</option>
            {MESES.map((m, i) => (
              <option key={m} value={String(i + 1).padStart(2, '0')}>{m}</option>
            ))}
          </select>

          <select
            value={localAno}
            onChange={e => handleAno(e.target.value)}
            className={localMes && !localAno ? selectIncClass : selectClass}
          >
            <option value="">Ano</option>
            {anos.map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>

          {(localMes || localAno) && (
            <button
              onClick={limpar}
              title="Limpar filtro"
              className="text-gray-400 hover:text-gray-600 text-sm px-1.5 py-1 rounded-lg border border-gray-200 bg-white leading-none"
            >
              ✕
            </button>
          )}
        </div>

        {incompleto && (
          <span className="text-[10px] text-[#D4A800]">
            Selecione também o {localMes ? 'ano' : 'mês'}
          </span>
        )}
      </div>
    </div>
  )
}
