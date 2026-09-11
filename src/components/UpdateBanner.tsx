import { useCallback, useEffect, useState } from 'react'
import { APP_VERSION } from '../version'

const CHECK_EVERY_MS = 5 * 60 * 1000

/** Asks the server what the current build is, bypassing the cache entirely.
 *
 *  GitHub Pages serves every file with `max-age=600` and its headers cannot be
 *  configured, so a tab left open — or reopened within ten minutes — keeps
 *  running the old build with no way to know. `no-store` sidesteps that.
 */
async function fetchDeployedVersion(signal: AbortSignal): Promise<string | null> {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}version.json`, {
      cache: 'no-store',
      signal,
    })
    if (!response.ok) return null
    const body = (await response.json()) as { version?: string }
    return body.version ?? null
  } catch {
    return null // offline or blocked: staying quiet is better than nagging
  }
}

export function UpdateBanner() {
  const [deployed, setDeployed] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    const check = async () => {
      if (document.visibilityState === 'hidden') return
      const version = await fetchDeployedVersion(controller.signal)
      if (version && version !== APP_VERSION) setDeployed(version)
    }

    void check()
    const timer = setInterval(check, CHECK_EVERY_MS)
    document.addEventListener('visibilitychange', check)
    return () => {
      controller.abort()
      clearInterval(timer)
      document.removeEventListener('visibilitychange', check)
    }
  }, [])

  // A reload revalidates index.html, and every data URL carries the new version.
  const reload = useCallback(() => window.location.reload(), [])

  if (!deployed) return null
  return (
    <div className="update" role="status">
      <span>Вышла версия {deployed}</span>
      <button className="update__button" onClick={reload}>
        Обновить
      </button>
    </div>
  )
}
