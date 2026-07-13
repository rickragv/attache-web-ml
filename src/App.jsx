import { useEffect } from 'react'
import { AppShell } from './components/AppShell.jsx'
import { AskView } from './views/AskView.jsx'
import { LibraryView } from './views/LibraryView.jsx'
import { RoutingView } from './views/RoutingView.jsx'
import { CompareView } from './views/CompareView.jsx'
import { SystemView } from './views/SystemView.jsx'
import { useStore } from './state/store.js'
import { bootEngine } from './services/engineService.js'

const VIEWS = {
  ask: AskView,
  library: LibraryView,
  routing: RoutingView,
  compare: CompareView,
  system: SystemView,
}

let booted = false

export default function App() {
  const view = useStore((s) => s.view)
  const setOnline = useStore((s) => s.setOnline)

  useEffect(() => {
    if (!booted) {
      booted = true
      bootEngine().catch((err) => console.error('[attache] boot failed', err))
    }
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [setOnline])

  const View = VIEWS[view] ?? AskView
  return (
    <AppShell>
      <View />
    </AppShell>
  )
}
