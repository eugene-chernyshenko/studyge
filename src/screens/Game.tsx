import { useCallback, useEffect, useMemo, useRef } from 'react'
import { MapBoard } from '../components/MapBoard'
import { Modal } from '../components/Modal'
import { useGame } from '../game/store'
import { QUESTION_SECONDS, promptFor } from '../game/quiz'

/** Palette for regions already answered — bright and distinguishable side by side. */
const ANSWERED_COLORS = [
  '#f97316',
  '#facc15',
  '#7c3aed',
  '#22c55e',
  '#06b6d4',
  '#ec4899',
  '#3b82f6',
  '#84cc16',
  '#a855f7',
  '#14b8a6',
]

export function Game() {
  const { phase, set, mode, questions, index, selectedId, answers, timeLeft, paused, progress } = useGame()
  const { select, confirm, next, tick, setPaused, quit } = useGame()
  const frame = useRef(0)
  const last = useRef(0)

  // Projecting a few hundred polygons takes a moment; the player should not lose
  // seconds off the clock to a map they cannot see yet. The ref lives here rather
  // than in the store because Game remounts for every round — so it resets itself.
  const boardReady = useRef(false)
  const onBoardReady = useCallback(() => {
    boardReady.current = true
  }, [])

  useEffect(() => {
    const loop = (now: number) => {
      if (last.current && boardReady.current) tick((now - last.current) / 1000)
      last.current = now
      frame.current = requestAnimationFrame(loop)
    }
    frame.current = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(frame.current)
      last.current = 0
    }
  }, [tick])

  // Auto-advance shortly after the answer is shown, like the original's pacing.
  useEffect(() => {
    if (phase !== 'revealing') return
    const timer = setTimeout(next, 1600)
    return () => clearTimeout(timer)
  }, [phase, index, next])

  const answered = useMemo(() => {
    const map = new Map<string, string>()
    answers.forEach((answer, i) => {
      map.set(answer.question.region.id, answer.correct ? ANSWERED_COLORS[i % ANSWERED_COLORS.length] : '#cbd5e1')
    })
    return map
  }, [answers])

  if (!set) return null
  const question = questions[index]
  const lastAnswer = phase === 'revealing' ? answers[answers.length - 1] : null
  const coinsThisRound = answers.reduce((sum, a) => sum + a.coins, 0)
  const isChoice = mode !== 'locate'

  return (
    <div className="game">
      <MapBoard
        set={set}
        selectedId={isChoice ? null : selectedId}
        reveal={lastAnswer ? { correctId: lastAnswer.question.region.id, pickedId: lastAnswer.pickedId } : null}
        answered={answered}
        onSelect={select}
        onReady={onBoardReady}
        interactive={phase === 'playing' && !isChoice}
      />

      <div className="hud hud--top">
        <div className="pill pill--coins">
          <span className="coin" aria-hidden="true" />
          {progress.coins + coinsThisRound}
        </div>

        <div className="prompt">
          <div
            className="prompt__timer"
            style={{ width: `${(timeLeft / QUESTION_SECONDS) * 100}%` }}
            data-low={timeLeft < 5 || undefined}
          />
          <span className="prompt__text">
            {mode === 'flag' ? (
              <>
                Флаг какой страны?{' '}
                <img
                  className="flag"
                  src={`${import.meta.env.BASE_URL}flags/${question.region.iso2}.svg`}
                  alt=""
                  width={34}
                  height={24}
                />
              </>
            ) : (
              promptFor(mode, question)
            )}
          </span>
        </div>

        <button className="icon-button" onClick={() => setPaused(!paused)} aria-label="Пауза">
          {paused ? '▶' : '❚❚'}
        </button>
      </div>

      <div className="hud hud--bottom">
        <div className="pill">
          {index + 1}/{questions.length}
        </div>

        {isChoice ? (
          <div className="options">
            {question.options.map((option) => {
              const state = !lastAnswer
                ? selectedId === option.id
                  ? 'selected'
                  : ''
                : option.id === question.region.id
                  ? 'correct'
                  : option.id === lastAnswer.pickedId
                    ? 'wrong'
                    : ''
              return (
                <button
                  key={option.id}
                  className={`option ${state}`}
                  disabled={phase !== 'playing'}
                  onClick={() => select(option.id)}
                >
                  {mode === 'capital' ? option.capital : option.name}
                </button>
              )
            })}
          </div>
        ) : null}

        <button
          className="confirm"
          disabled={phase !== 'playing' || !selectedId}
          onClick={confirm}
        >
          Подтвердить
        </button>
      </div>

      {lastAnswer ? (
        <div className={`verdict ${lastAnswer.correct ? 'verdict--ok' : 'verdict--no'}`}>
          <span>
            {lastAnswer.correct
              ? `Верно  +${lastAnswer.coins}`
              : `${question.region.name} — вот здесь`}
          </span>
        </div>
      ) : null}

      {paused ? (
        <Modal label="Пауза" onDismiss={() => setPaused(false)}>
          <h2>Пауза</h2>
          <button className="confirm" onClick={() => setPaused(false)}>
            Продолжить
          </button>
          <button className="ghost" onClick={quit}>
            Выйти в меню
          </button>
        </Modal>
      ) : null}
    </div>
  )
}
