import { create } from 'zustand'
import type { GameMode, MapSet, MapSetMeta, QuizMode } from '../data/types'
import { loadSet } from '../data/loadSet'
import { ROUND_LENGTH, QUESTION_SECONDS, buildRound, buildReviewRound, coinsFor } from './quiz'
import type { Answer, Question } from './quiz'
import { loadProgress, saveProgress, recordAnswer, type Progress } from './progress'

type Phase = 'menu' | 'loading' | 'learning' | 'playing' | 'revealing' | 'finished'

export const progressKey = (setId: string, mode: QuizMode) => `${setId}:${mode}`

interface GameState {
  phase: Phase
  set?: MapSet
  mode: QuizMode
  /** True when the round was built only from previously missed regions. */
  reviewing: boolean
  questions: Question[]
  index: number
  /** Region the player has tapped but not confirmed yet. */
  selectedId: string | null
  answers: Answer[]
  timeLeft: number
  paused: boolean
  error?: string
  progress: Progress

  start(meta: MapSetMeta, mode: GameMode): Promise<void>
  startReview(meta: MapSetMeta, mode: QuizMode): Promise<void>
  select(regionId: string): void
  confirm(): void
  next(): void
  tick(delta: number): void
  setPaused(paused: boolean): void
  setTimerEnabled(enabled: boolean): void
  quit(): void
}

export const useGame = create<GameState>((set, get) => {
  /** Shared entry point for both a normal round and a mistakes-only round. */
  async function begin(
    meta: MapSetMeta,
    mode: QuizMode,
    build: (mapSet: MapSet, mistakes: Record<string, number>) => Question[],
    reviewing: boolean,
  ) {
    set({ phase: 'loading', error: undefined, mode, reviewing })
    try {
      const mapSet = await loadSet(meta)
      const questions = build(mapSet, get().progress.mistakes[progressKey(meta.id, mode)] ?? {})
      if (!questions.length) {
        set({ phase: 'menu', error: 'Не из чего собрать раунд' })
        return
      }
      set({
        phase: 'playing',
        set: mapSet,
        questions,
        index: 0,
        selectedId: null,
        answers: [],
        timeLeft: QUESTION_SECONDS,
        paused: false,
      })
    } catch (cause) {
      set({
        phase: 'menu',
        error: cause instanceof Error ? cause.message : 'Не удалось загрузить карту',
      })
    }
  }

  return {
    phase: 'menu',
    mode: 'locate',
    reviewing: false,
    questions: [],
    index: 0,
    selectedId: null,
    answers: [],
    timeLeft: QUESTION_SECONDS,
    paused: false,
    progress: loadProgress(),

    async start(meta, mode) {
      if (mode === 'learn') {
        set({ phase: 'loading', error: undefined })
        try {
          set({ phase: 'learning', set: await loadSet(meta), selectedId: null })
        } catch (cause) {
          set({
            phase: 'menu',
            error: cause instanceof Error ? cause.message : 'Не удалось загрузить карту',
          })
        }
        return
      }
      await begin(meta, mode, (mapSet, mistakes) => buildRound(mapSet, mode, mistakes), false)
    },

    async startReview(meta, mode) {
      await begin(meta, mode, (mapSet, mistakes) => buildReviewRound(mapSet, mode, mistakes), true)
    },

    select(regionId) {
      const { phase } = get()
      if (phase !== 'playing' && phase !== 'learning') return
      set({ selectedId: regionId })
    },

    confirm() {
      const { phase, questions, index, selectedId, timeLeft, answers, progress, set: mapSet, mode } = get()
      if (phase !== 'playing') return
      const question = questions[index]
      const correct = selectedId === question.region.id
      const coins = coinsFor(correct, timeLeft, progress.timerEnabled)

      // Bank the result now. Crediting only at the end of a round meant that
      // leaving after eight correct answers threw all of them away.
      const key = mapSet ? progressKey(mapSet.meta.id, mode) : ''
      const updated: Progress = {
        ...progress,
        coins: progress.coins + coins,
        mistakes: recordAnswer(progress.mistakes, key, question.region.id, correct),
      }
      saveProgress(updated)

      set({
        phase: 'revealing',
        progress: updated,
        answers: [...answers, { question, pickedId: selectedId, correct, timeLeft, coins }],
      })
    },

    next() {
      const { index, questions, answers, set: mapSet, mode, progress } = get()
      if (index + 1 < questions.length) {
        set({ phase: 'playing', index: index + 1, selectedId: null, timeLeft: QUESTION_SECONDS })
        return
      }

      // Coins and mistakes were already banked per answer; only the record is left.
      const key = mapSet ? progressKey(mapSet.meta.id, mode) : ''
      const rightCount = answers.filter((a) => a.correct).length
      const updated: Progress = {
        ...progress,
        best: { ...progress.best, [key]: Math.max(progress.best[key] ?? 0, rightCount) },
      }
      saveProgress(updated)
      set({ phase: 'finished', progress: updated })
    },

    tick(delta) {
      const { phase, paused, timeLeft, progress } = get()
      if (phase !== 'playing' || paused || !progress.timerEnabled) return
      const left = timeLeft - delta
      if (left > 0) {
        set({ timeLeft: left })
        return
      }
      // Running out of time is a wrong answer, not a skipped one.
      set({ timeLeft: 0 })
      get().confirm()
    },

    setPaused(paused) {
      set({ paused })
    },

    setTimerEnabled(enabled) {
      const updated = { ...get().progress, timerEnabled: enabled }
      saveProgress(updated)
      set({ progress: updated, timeLeft: QUESTION_SECONDS })
    },

    quit() {
      set({ phase: 'menu', questions: [], answers: [], index: 0, selectedId: null })
    },
  }
})

export { ROUND_LENGTH, QUESTION_SECONDS }
