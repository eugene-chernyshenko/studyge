import { useMemo, useState } from 'react'
import { MapBoard } from '../components/MapBoard'
import { useGame } from '../game/store'
import { cacheBust } from '../version'
import type { Region } from '../data/types'

const EMPTY = new Map<string, string>()

/** Browse mode: no clock, no score — tap a region (or a name) and see what it is. */
export function Learn() {
  const { set, selectedId, select, start, quit } = useGame()
  const [query, setQuery] = useState('')

  const sorted = useMemo(
    () => (set ? [...set.regions].sort((a, b) => a.name.localeCompare(b.name, 'ru')) : []),
    [set],
  )
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return sorted
    return sorted.filter(
      (r) => r.name.toLowerCase().includes(needle) || r.nameEn.toLowerCase().includes(needle),
    )
  }, [sorted, query])

  if (!set) return null
  const current = set.regions.find((r) => r.id === selectedId)
  const quizMode = set.meta.modes.find((m) => m !== 'learn') ?? 'locate'

  return (
    <div className="learn">
      <div className="learn__map">
        <MapBoard
          set={set}
          selectedId={selectedId}
          reveal={null}
          answered={EMPTY}
          onSelect={select}
          showCentres
          interactive
        />
        <div className="hud hud--top">
          <button className="pill pill--button" onClick={quit}>
            ← В меню
          </button>
          <div className="prompt prompt--static">
            <span className="prompt__text">{current ? describe(current) : set.meta.title}</span>
          </div>
          <button className="confirm confirm--compact" onClick={() => start(set.meta, quizMode)}>
            Проверить себя
          </button>
        </div>
      </div>

      <aside className="learn__list">
        <input
          className="search"
          type="search"
          value={query}
          placeholder={`Поиск среди ${set.regions.length}`}
          onChange={(event) => setQuery(event.target.value)}
        />
        <ul>
          {visible.map((region) => (
            <li key={region.id}>
              <button
                className={region.id === selectedId ? 'region-row region-row--active' : 'region-row'}
                onClick={() => select(region.id)}
              >
                {region.iso2 ? (
                  <img
                    className="flag flag--small"
                    src={`${import.meta.env.BASE_URL}flags/${region.iso2}.svg${cacheBust}`}
                    alt=""
                    width={24}
                    height={18}
                    loading="lazy"
                  />
                ) : null}
                <span className="region-row__name">{region.name}</span>
                {region.centre ? <span className="region-row__sub">{region.centre}</span> : null}
              </button>
            </li>
          ))}
        </ul>
        {visible.length === 0 ? <p className="notice">Ничего не найдено</p> : null}
      </aside>
    </div>
  )
}

function describe(region: Region): string {
  if (region.capital) return `${region.name} · столица ${region.capital}`
  return region.centre ? `${region.name} · центр ${region.centre}` : region.name
}
