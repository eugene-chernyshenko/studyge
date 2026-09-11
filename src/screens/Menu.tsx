import { useEffect, useState } from 'react'
import { loadManifest } from '../data/loadSet'
import type { GameMode, MapSetMeta, QuizMode } from '../data/types'
import { useGame, progressKey } from '../game/store'
import { mistakeCount } from '../game/progress'

const MODE_LABELS: Record<GameMode, string> = {
  learn: 'Изучать',
  locate: 'На карте',
  flag: 'Флаги',
  capital: 'Столицы',
}

export function Menu() {
  const [sets, setSets] = useState<MapSetMeta[] | null>(null)
  const [failed, setFailed] = useState(false)
  const { start, startReview, setTimerEnabled, progress, error } = useGame()

  useEffect(() => {
    loadManifest().then(setSets, () => setFailed(true))
  }, [])

  if (failed) return <p className="notice">Не удалось загрузить список карт.</p>
  if (!sets) return <p className="notice">Загрузка…</p>

  const groups = [...new Set(sets.map((s) => s.group))]

  return (
    <div className="menu">
      <header className="menu__head">
        <div>
          <h1>StudyGe</h1>
          <p className="menu__sub">География мира</p>
        </div>
        <div className="menu__head-right">
          <button
            className={progress.timerEnabled ? 'mode' : 'mode mode--off'}
            onClick={() => setTimerEnabled(!progress.timerEnabled)}
            title="Отсчёт времени на каждый вопрос"
          >
            {progress.timerEnabled ? 'Таймер: вкл' : 'Таймер: выкл'}
          </button>
          <div className="pill pill--coins">
            <span className="coin" aria-hidden="true" />
            {progress.coins}
          </div>
        </div>
      </header>

      {error ? <p className="notice notice--error">{error}</p> : null}

      {groups.map((group) => (
        <section key={group}>
          <h2 className="menu__group">{group}</h2>
          <ul className="sets">
            {sets
              .filter((s) => s.group === group)
              .map((meta) => {
                // Records and mistakes are tracked per quiz mode; the menu summarises
                // the set's main one so the row stays a single line.
                const mainMode = (meta.modes.find((m) => m !== 'learn') ?? 'locate') as QuizMode
                const key = progressKey(meta.id, mainMode)
                const best = progress.best[key]
                const missed = mistakeCount(progress.mistakes, key)

                return (
                  <li key={meta.id} className="set">
                    <div className="set__info">
                      <span className="set__title">{meta.title}</span>
                      <span className="set__meta">
                        {meta.count} {meta.unitPlural}
                        {best ? ` · рекорд ${best}/10` : ''}
                      </span>
                    </div>
                    <div className="set__modes">
                      {meta.modes.map((mode) => (
                        <button
                          key={mode}
                          className={mode === 'learn' ? 'mode mode--learn' : 'mode'}
                          onClick={() => start(meta, mode)}
                        >
                          {MODE_LABELS[mode]}
                        </button>
                      ))}
                      {missed > 0 ? (
                        <button
                          className="mode mode--review"
                          onClick={() => startReview(meta, mainMode)}
                          title="Повторить регионы, в которых были ошибки"
                        >
                          Ошибки · {missed}
                        </button>
                      ) : null}
                    </div>
                  </li>
                )
              })}
          </ul>
        </section>
      ))}

      <footer className="menu__foot">
        Границы: Natural Earth (public domain) и geoBoundaries (CC BY 4.0). Названия — Natural Earth и
        Wikidata.
      </footer>
    </div>
  )
}
