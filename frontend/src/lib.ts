export const API: string = (import.meta as any).env?.VITE_API_BASE ?? 'http://localhost:8000'
export const REPO = 'https://github.com/PeerAhammad/PARD-SSM-Probabilistic-Attack-Regime-Detection'

export async function getJSON(url: string, ms = 0) {
  const ctl = new AbortController()
  const timer = ms ? setTimeout(() => ctl.abort(), ms) : undefined
  try {
    const r = await fetch(url, { signal: ctl.signal })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    return await r.json()
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export async function runPredict(mode: string, dataset: string, file?: File) {
  if (mode === 'connecting') throw new Error('The backend is still connecting. Please wait a moment.')
  if (mode === 'precomputed') {
    if (file) throw new Error('The backend is unavailable, so uploaded files cannot be processed. Only the precomputed demo results can be shown.')
    return getJSON(`/precomputed/predict_${dataset}.json`)
  }
  const fd = new FormData()
  fd.append('dataset', dataset)
  if (file) fd.append('file', file)
  else fd.append('use_demo', 'true')
  const r = await fetch(`${API}/api/predict`, { method: 'POST', body: fd })
  const j = await r.json().catch(() => null)
  if (!r.ok) {
    const d = j?.detail
    throw new Error(typeof d === 'string' ? d : d ? JSON.stringify(d) : `Request failed (${r.status})`)
  }
  return j
}

export const pct = (x: number, d = 1) => `${(x * 100).toFixed(d)}%`
export const f3 = (x: number) => x.toFixed(3)

export function thin<T>(a: T[], n = 800): T[] {
  if (a.length <= n) return a
  const k = Math.ceil(a.length / n)
  return a.filter((_, i) => i % k === 0)
}

export function downloadCSV(res: any) {
  const hasLabel = res.predictions[0]?.label !== undefined
  const head = ['row', 'attack_probability', 'predicted_class', 'regime', ...(hasLabel ? ['label'] : [])]
  const lines = res.predictions.map((r: any) =>
    [r.row, r.attack_probability, r.predicted ? 'attack' : 'benign', `Regime ${r.regime}`, ...(hasLabel ? [r.label] : [])].join(','))
  const blob = new Blob([head.join(',') + '\n' + lines.join('\n')], { type: 'text/csv' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `pard_ssm_${res.dataset}_predictions.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}