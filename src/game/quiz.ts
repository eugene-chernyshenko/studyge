import type { MapSet, QuizMode, Region } from '../data/types'

export const ROUND_LENGTH = 10
export const QUESTION_SECONDS = 15

export interface Question {
  region: Region
  /** Only for the multiple-choice modes; always includes `region`. */
  options: Region[]
}

export interface Answer {
  question: Question
  pickedId: string | null
  correct: boolean
  /** Seconds left when the answer was locked in — drives the speed bonus. */
  timeLeft: number
  coins: number
}

/** Sample without replacement, where a higher weight means a better chance of
 *  being drawn. Used to resurface regions the player keeps getting wrong. */
function weightedSample<T>(
  items: readonly T[],
  count: number,
  weightOf: (item: T) => number,
  random: () => number,
): T[] {
  const pool = items.map((item) => ({ item, weight: Math.max(weightOf(item), 0.0001) }))
  const picked: T[] = []
  let total = pool.reduce((sum, entry) => sum + entry.weight, 0)

  while (picked.length < count && pool.length) {
    let threshold = random() * total
    let index = pool.findIndex((entry) => (threshold -= entry.weight) <= 0)
    if (index < 0) index = pool.length - 1
    total -= pool[index].weight
    picked.push(pool.splice(index, 1)[0].item)
  }
  return picked
}

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const out = items.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** Multiple-choice distractors are drawn from the same neighbourhood so the
 *  wrong answers stay plausible rather than obviously continental. */
function pickOptions(target: Region, pool: Region[], random: () => number): Region[] {
  const near = pool
    .filter((r) => r.id !== target.id)
    .sort((a, b) => sqDist(a, target) - sqDist(b, target))
    .slice(0, 12)
  const distractors = shuffle(near, random).slice(0, 3)
  return shuffle([target, ...distractors], random)
}

const sqDist = (a: Region, b: Region) => (a.c[0] - b.c[0]) ** 2 + (a.c[1] - b.c[1]) ** 2

function poolFor(set: MapSet, mode: QuizMode): Region[] {
  if (mode === 'flag') return set.regions.filter((r) => r.iso2)
  if (mode === 'capital') return set.regions.filter((r) => r.capital)
  return set.regions
}

const asQuestions = (regions: Region[], mode: QuizMode, pool: Region[], random: () => number) =>
  regions.map((region) => ({
    region,
    options: mode === 'locate' ? [] : pickOptions(region, pool, random),
  }))

export function buildRound(
  set: MapSet,
  mode: QuizMode,
  mistakes: Record<string, number> = {},
  random: () => number = Math.random,
): Question[] {
  const pool = poolFor(set, mode)
  // Every region can come up, but a missed one is up to four times as likely.
  const picked = weightedSample(
    pool,
    Math.min(ROUND_LENGTH, pool.length),
    (region) => 1 + (mistakes[region.id] ?? 0) * 0.75,
    random,
  )
  return asQuestions(picked, mode, pool, random)
}

/** A round made only of regions the player has missed before. */
export function buildReviewRound(
  set: MapSet,
  mode: QuizMode,
  mistakes: Record<string, number>,
  random: () => number = Math.random,
): Question[] {
  const pool = poolFor(set, mode)
  const missed = pool.filter((region) => mistakes[region.id])
  const picked = shuffle(missed, random).slice(0, ROUND_LENGTH)
  return asQuestions(picked, mode, pool, random)
}

/** 10 coins for a correct answer plus up to 5 for answering quickly. */
export function coinsFor(correct: boolean, timeLeft: number): number {
  if (!correct) return 0
  return 10 + Math.round((Math.max(0, timeLeft) / QUESTION_SECONDS) * 5)
}

export function promptFor(mode: QuizMode, q: Question): string {
  switch (mode) {
    case 'locate':
      return `Где находится ${q.region.name}?`
    case 'flag':
      return `Флаг какой страны?`
    case 'capital':
      // Name first, in the nominative — Russian country names decline and the
      // question reads wrong as "Столица страны Шри-Ланка?".
      return `${q.region.name}: какая столица?`
  }
}
