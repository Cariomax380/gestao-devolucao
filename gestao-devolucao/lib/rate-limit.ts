/**
 * Rate limiter em memória com sliding window.
 *
 * NOTA: funciona em deploy single-instance (local, VM, container único).
 * Em ambientes serverless multi-instância (Vercel Edge, AWS Lambda) cada
 * instância tem seu próprio store — o limite efetivo fica multiplicado pelo
 * número de instâncias. Para esses cenários migrar para Upstash/Redis.
 */

interface WindowEntry {
  readonly count: number
  readonly windowStart: number
}

const store = new Map<string, WindowEntry>()

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  /** Milissegundos até o próximo reset da janela */
  resetMs: number
}

/**
 * Verifica se a chave `key` está dentro do limite.
 *
 * @param key        Identificador único (ex.: user UUID, IP)
 * @param maxRequests Máximo de chamadas por janela (default 5)
 * @param windowMs   Duração da janela em ms (default 60 s)
 */
export function checkRateLimit(
  key: string,
  maxRequests = 5,
  windowMs = 60_000,
): RateLimitResult {
  const now = Date.now()
  const entry = store.get(key)

  // Janela expirada ou primeira chamada
  if (!entry || now - entry.windowStart >= windowMs) {
    store.set(key, { count: 1, windowStart: now })
    return { allowed: true, remaining: maxRequests - 1, resetMs: windowMs }
  }

  // Limite atingido
  if (entry.count >= maxRequests) {
    const resetMs = windowMs - (now - entry.windowStart)
    return { allowed: false, remaining: 0, resetMs }
  }

  // Incremento imutável
  store.set(key, { count: entry.count + 1, windowStart: entry.windowStart })
  const remaining = maxRequests - (entry.count + 1)
  const resetMs   = windowMs - (now - entry.windowStart)
  return { allowed: true, remaining, resetMs }
}
