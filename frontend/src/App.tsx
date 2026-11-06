import { useEffect, useState } from 'react'
import { Activity, BarChart3, BookOpen, ExternalLink, FlaskConical, LayoutDashboard, Menu, X } from 'lucide-react'
import { API, REPO, getJSON, runPredict } from './lib'
import { Badge, Banner, Spinner } from './ui'
import Overview from './pages/Overview'
import LiveDemo from './pages/LiveDemo'
import RegimeExplorer from './pages/RegimeExplorer'
import Results from './pages/Results'
import Methodology from './pages/Methodology'

const PAGES: [string, string, any, string][] = [
  ['overview', 'Overview', LayoutDashboard, 'Project introduction and headline results'],
  ['demo', 'Live Demo', FlaskConical, 'Run the trained pipelines on a sample or your own CSV'],
  ['regimes', 'Regime Explorer', Activity, 'Inspect the switching state-space filter outputs'],
  ['results', 'Results', BarChart3, 'Repository-reported versus newly reproduced evaluation'],
  ['methodology', 'Methodology & Limitations', BookOpen, 'How it works, and where it falls short'],
]

const Logo = () => (
  <svg width="42" height="42" viewBox="0 0 42 42" aria-hidden>
    <defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#3F5EC2" /><stop offset="1" stopColor="#1F9F97" /></linearGradient></defs>
    <rect width="42" height="42" rx="13" fill="#fff" />
    <path d="M8 26 C12 12 17 12 21 21 S30 31 34 15" fill="none" stroke="url(#lg)" strokeWidth="3.4" strokeLinecap="round" />
    <circle cx="34" cy="15" r="3" fill="#9B5ECB" />
  </svg>
)

export default function App() {
  const read = () => location.hash.replace('#/', '') || 'overview'
  const [page, setPage] = useState(read)
  const [open, setOpen] = useState(false)
  const [demo, setDemo] = useState<any>(null)
  const [mode, setMode] = useState<'connecting' | 'live' | 'precomputed'>('connecting')
  const [results, setResults] = useState<Record<string, any>>({})
  const [err, setErr] = useState('')

  useEffect(() => {
    const h = () => { setPage(read()); setOpen(false); window.scrollTo(0, 0) }
    const k = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('hashchange', h)
    window.addEventListener('keydown', k)
    return () => { window.removeEventListener('hashchange', h); window.removeEventListener('keydown', k) }
  }, [])

  useEffect(() => {
    (async () => {
      let pre: any = null
      try { pre = await getJSON('/precomputed/demo.json'); setDemo(pre) } catch { /* handled below */ }
      try {
        await getJSON(`${API}/api/health`, 75000)           // free-tier cold start can take ~1 minute
        setDemo(await getJSON(`${API}/api/demo`, 20000))
        setMode('live')
      } catch {
        setMode('precomputed')
        if (!pre) setErr('The backend is unreachable and no precomputed results were found.')
      }
    })()
  }, [])

  const run = async (dataset: string, file?: File) => {
    const r = await runPredict(mode, dataset, file)
    setResults((p) => ({ ...p, [dataset]: r }))
    return r
  }
  const app = { demo, mode, results, run }
  const Page: any = { overview: Overview, demo: LiveDemo, regimes: RegimeExplorer, results: Results, methodology: Methodology }[page] ?? Overview
  const cur = PAGES.find((p) => p[0] === page) ?? PAGES[0]
  const modeBadge = mode === 'live' ? <Badge tone="teal"><span className="h-2 w-2 rounded-full bg-lagoon-line" />Live backend connected</Badge>
    : mode === 'connecting' ? <Badge tone="amber"><Spinner size={12} />Connecting…</Badge>
    : <Badge tone="red"><span className="h-2 w-2 rounded-full bg-coral-line" />Backend offline</Badge>

  return (
    <div className="min-h-screen">
      {open && <div className="fixed inset-0 z-30 bg-ink/50 lg:hidden" onClick={() => setOpen(false)} aria-hidden />}

      <aside aria-label="Main navigation"
        className={`sidebar-bg on-dark fixed inset-y-0 left-0 z-40 flex w-72 flex-col gap-7 px-5 py-6 shadow-2xl transition-transform duration-300 lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between">
          <a href="#/overview" className="flex items-center gap-3">
            <Logo />
            <div>
              <div className="text-lg font-extrabold leading-none tracking-tight">PARD-SSM</div>
              <div className="mt-1 text-xs font-bold uppercase tracking-[0.2em]">Explorer</div>
            </div>
          </a>
          <button className="rounded-lg p-1.5 lg:hidden" onClick={() => setOpen(false)} aria-label="Close navigation"><X size={20} /></button>
        </div>

        <nav className="flex flex-col gap-1.5">
          <div className="px-2 pb-1 text-xs font-bold uppercase tracking-[0.16em]">Navigate</div>
          {PAGES.map(([id, name, Icon]) => (
            <a key={id} href={`#/${id}`} className="nav-link" aria-current={page === id ? 'page' : undefined}>
              <Icon size={19} aria-hidden />{name}
            </a>
          ))}
        </nav>

        <div className="mt-auto space-y-3">
          <div className="glass rounded-2xl p-4 text-sm">
            <div className="text-xs font-bold uppercase tracking-[0.16em]">Inference backend</div>
            <div className="mt-1.5 font-bold">{mode === 'live' ? 'Live — real model inference' : mode === 'connecting' ? 'Connecting…' : 'Offline — precomputed results'}</div>
            <div className="mt-1 text-xs leading-relaxed">{mode === 'live' ? 'Uploads and demo runs execute the exported pipelines.' : mode === 'connecting' ? 'Free-tier servers can take about a minute to wake.' : 'CSV uploads are unavailable until the backend is reachable.'}</div>
          </div>
          <a href={REPO} target="_blank" rel="noreferrer" className="nav-link"><ExternalLink size={18} aria-hidden />GitHub repository</a>
        </div>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-line/70 bg-page/80 backdrop-blur">
          <div className="mx-auto flex max-w-[1200px] items-center gap-3 px-4 py-3 sm:px-8">
            <button className="btn btn-soft !p-2.5 lg:hidden" onClick={() => setOpen(true)} aria-label="Open navigation"><Menu size={20} /></button>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-lg font-extrabold tracking-tight text-ink">{cur[1]}</h1>
              <p className="hidden truncate text-xs text-ink2 sm:block">{cur[3]}</p>
            </div>
            {modeBadge}
            <a href={REPO} target="_blank" rel="noreferrer" className="btn btn-soft hidden sm:inline-flex"><ExternalLink size={16} aria-hidden />GitHub</a>
          </div>
        </header>

        <main className="mx-auto max-w-[1200px] space-y-8 px-4 py-8 sm:px-8">
          {mode === 'precomputed' && <Banner tone="warn" title="Precomputed Model Results — Not Live Inference.">The backend is unavailable, so the results shown come from genuine model runs saved earlier. CSV uploads cannot be processed.</Banner>}
          {mode === 'connecting' && <Banner>Connecting to the backend. Free-tier servers can take up to a minute to wake up. Static results below are precomputed until it connects.</Banner>}
          {err && <Banner tone="bad">{err}</Banner>}
          <Page app={app} />
        </main>
        <footer className="border-t border-line/70 py-6 text-center text-xs text-ink2">
          Research demonstration, not a production security tool. Apache-2.0 licence.
        </footer>
      </div>
    </div>
  )
}