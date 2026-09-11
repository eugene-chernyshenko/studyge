export type MistakeLog = Record<string, Record<string, number>>

export interface Progress {
  coins: number
  /** Best number of correct answers, keyed by `${setId}:${mode}`. */
  best: Record<string, number>
  /** How often each region was missed, keyed by `${setId}:${mode}` then region id. */
  mistakes: MistakeLog
}

const KEY = 'studyge.progress.v3'
// v2 keyed mistakes by Natural Earth's internal region codes; v3 uses ISO 3166-2,
// so those entries can no longer be matched and are dropped on upgrade.
const LEGACY_KEY = 'studyge.progress.v2'
const EMPTY: Progress = { coins: 0, best: {}, mistakes: {} }

function parse(raw: string): Progress {
  const parsed = JSON.parse(raw) as Partial<Progress>
  return {
    coins: parsed.coins ?? 0,
    best: parsed.best ?? {},
    mistakes: parsed.mistakes ?? {},
  }
}

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return parse(raw)
    // v1 knew nothing about mistakes; carry over coins and records.
    const legacy = localStorage.getItem(LEGACY_KEY)
    return legacy ? { ...parse(legacy), mistakes: {} } : EMPTY
  } catch {
    return EMPTY // private mode / corrupted entry — play on without persistence
  }
}

export function saveProgress(progress: Progress): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(progress))
  } catch {
    /* not fatal */
  }
}

/** A wrong answer adds weight, a right one pays it back — regions leave the
 *  review pool once you have actually learned them. */
export function recordAnswer(
  mistakes: MistakeLog,
  key: string,
  regionId: string,
  correct: boolean,
): MistakeLog {
  const forKey = { ...(mistakes[key] ?? {}) }
  const current = forKey[regionId] ?? 0
  const next = correct ? current - 1 : current + 1

  if (next <= 0) delete forKey[regionId]
  else forKey[regionId] = Math.min(next, 5) // cap so one region cannot dominate

  const updated = { ...mistakes }
  if (Object.keys(forKey).length) updated[key] = forKey
  else delete updated[key]
  return updated
}

export const mistakeCount = (mistakes: MistakeLog, key: string) =>
  Object.keys(mistakes[key] ?? {}).length
