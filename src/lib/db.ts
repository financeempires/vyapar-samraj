import { neon, neonConfig } from '@neondatabase/serverless'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not defined')
}

// Resilient fetch wrapper for Neon serverless HTTP queries.
// Handles transient network/socket drops (e.g. idle keep-alive socket closed by remote
// server resulting in "TypeError: fetch failed", UND_ERR_SOCKET, or ECONNRESET).
// Retries up to 3 times with brief backoff so idle connection drops transparently reconnect.
const resilientFetch: typeof fetch = async (input, init) => {
  let lastError: any = null
  const maxRetries = 3

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fetch(input, init)
    } catch (err: any) {
      lastError = err
      const msg = String(err?.message || '')
      const code = String(err?.code || err?.cause?.code || '')
      const isTransient =
        err?.name === 'TypeError' ||
        msg.includes('fetch failed') ||
        code === 'UND_ERR_SOCKET' ||
        code === 'ECONNRESET' ||
        code === 'ETIMEDOUT' ||
        code === 'EPIPE'

      if (isTransient && attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 80))
        continue
      }
      throw err
    }
  }
  throw lastError
}

neonConfig.fetchFunction = resilientFetch

export const sql = neon(process.env.DATABASE_URL)

