/**
 * Rate limiter em memória — adequado para deploy de instância única (VPS/Docker).
 * Para deploy multi-instância, troque o Map por Redis (Upstash ou similar).
 *
 * Algoritmo: sliding window por IP/chave.
 */

interface Window {
  count: number;
  reset: number; // epoch ms
}

const store = new Map<string, Window>();

// Limpa entradas expiradas a cada 5 minutos.
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [k, w] of store) {
      if (w.reset < now) store.delete(k);
    }
  }, 5 * 60 * 1000);
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterMs: number;
}

/**
 * @param key   Chave de identificação (ex.: "webhook:<ip>", "login:<email>").
 * @param limit Máximo de requisições por janela.
 * @param windowMs Tamanho da janela em ms (padrão: 60 s).
 */
export function rateLimit(key: string, limit: number, windowMs = 60_000): RateLimitResult {
  const now = Date.now();
  let w = store.get(key);
  if (!w || w.reset < now) {
    w = { count: 0, reset: now + windowMs };
    store.set(key, w);
  }
  w.count++;
  const ok = w.count <= limit;
  return {
    ok,
    remaining: Math.max(0, limit - w.count),
    retryAfterMs: ok ? 0 : w.reset - now,
  };
}

/** Extrai o IP real da requisição (considera proxies comuns). */
export function getClientIp(request: Request): string {
  return (
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    "unknown"
  );
}
