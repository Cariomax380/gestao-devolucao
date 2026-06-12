import { ResultadoIndicador } from '@/types'

function calc(numerador: number | null, denominador: number | null, campo: string): ResultadoIndicador {
  if (numerador === null) return { valor: null, erro: `Indicador não calculado: ausência de ${campo}` }
  if (!denominador) return { valor: null, erro: `Indicador não calculado: ausência de ${campo}` }
  return { valor: (numerador / denominador) * 100 }
}

export function calcDevolucaoPdv(pdvsDevolvidos: number | null, pdvsFaturados: number | null): ResultadoIndicador {
  return calc(pdvsDevolvidos, pdvsFaturados, 'pdvs_faturados')
}

export function calcDevolucaoHL(volDevolvido: number | null, volFaturado: number | null): ResultadoIndicador {
  return calc(volDevolvido, volFaturado, 'volume_faturado_hl')
}

export function calcReversao(revertidas: number | null, apontados: number | null): ResultadoIndicador {
  return calc(revertidas, apontados, 'alertas_apontados')
}

export function calcRepassesApontados(programados: number | null, apontados: number | null): ResultadoIndicador {
  return calc(programados, apontados, 'alertas_apontados')
}

export function calcRepassesEfetivos(revertidasViaRepasse: number | null, informados: number | null): ResultadoIndicador {
  return calc(revertidasViaRepasse, informados, 'repasses_informados')
}

export function calcDevApontadasPct(apontados: number | null, totalDevolucoes: number | null): ResultadoIndicador {
  return calc(apontados, totalDevolucoes, 'total_devolucoes')
}

export function calcAderenciaRaio(dentroRaio: number | null, totalEntregas: number | null): ResultadoIndicador {
  return calc(dentroRaio, totalEntregas, 'total_entregas')
}

export function calcDevAntesHorario(antesLimite: number | null, totalDevolvidos: number | null): ResultadoIndicador {
  return calc(antesLimite, totalDevolvidos, 'total_devolvidos')
}

export function calcTempoMedioCME(temposMinutos: number[]): ResultadoIndicador {
  if (!temposMinutos.length) return { valor: null, erro: 'Indicador não calculado: ausência de horario_atendimento_cme' }
  const media = temposMinutos.reduce((a, b) => a + b, 0) / temposMinutos.length
  return { valor: media }
}

export function calcTempoMedioTratativa(temposMinutos: number[]): ResultadoIndicador {
  if (!temposMinutos.length) return { valor: null, erro: 'Indicador não calculado: ausência de horario_finalizacao' }
  const media = temposMinutos.reduce((a, b) => a + b, 0) / temposMinutos.length
  return { valor: media }
}
