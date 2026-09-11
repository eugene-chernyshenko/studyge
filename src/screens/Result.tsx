import { Modal } from '../components/Modal'
import { useGame, progressKey } from '../game/store'
import { mistakeCount } from '../game/progress'
import { ROUND_LENGTH } from '../game/quiz'

export function Result() {
  const { answers, set, mode, reviewing, progress, quit, start, startReview } = useGame()
  const right = answers.filter((a) => a.correct).length
  const coins = answers.reduce((sum, a) => sum + a.coins, 0)
  const missed = set ? mistakeCount(progress.mistakes, progressKey(set.meta.id, mode)) : 0

  return (
    <Modal label="Итоги раунда">
      <div className="card--result">
        <h2>
          {right} из {answers.length || ROUND_LENGTH}
        </h2>
        <p className="card__coins">
          <span className="coin" aria-hidden="true" /> +{coins}
        </p>
        {reviewing ? <p className="card__note">Раунд из прошлых ошибок</p> : null}

        <ul className="review">
          {answers.map((answer, i) => (
            <li key={i} className={answer.correct ? 'review__ok' : 'review__no'}>
              <span>{answer.question.region.name}</span>
              {!answer.correct ? (
                <span className="review__picked">
                  {answer.pickedId
                    ? `вы выбрали: ${set?.regions.find((r) => r.id === answer.pickedId)?.name ?? '—'}`
                    : 'время вышло'}
                </span>
              ) : null}
            </li>
          ))}
        </ul>

        <button className="confirm" onClick={() => set && start(set.meta, mode)}>
          Ещё раз
        </button>
        {missed > 0 ? (
          <button className="secondary" onClick={() => set && startReview(set.meta, mode)}>
            Работа над ошибками · {missed}
          </button>
        ) : null}
        <button className="ghost" onClick={quit}>
          В меню
        </button>
      </div>
    </Modal>
  )
}
