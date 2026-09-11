import { UpdateBanner } from './components/UpdateBanner'
import { useGame } from './game/store'
import { Menu } from './screens/Menu'
import { Learn } from './screens/Learn'
import { Game } from './screens/Game'
import { Result } from './screens/Result'

export default function App() {
  const phase = useGame((s) => s.phase)

  return (
    <>
      {screenFor(phase)}
      {/* Only on the menu: a banner over the confirm button would be in the way. */}
      {phase === 'menu' ? <UpdateBanner /> : null}
    </>
  )
}

function screenFor(phase: ReturnType<typeof useGame.getState>['phase']) {
  if (phase === 'menu') return <Menu />
  if (phase === 'loading') return <p className="notice">Загрузка карты…</p>
  if (phase === 'learning') return <Learn />
  return (
    <>
      <Game />
      {phase === 'finished' ? <Result /> : null}
    </>
  )
}
