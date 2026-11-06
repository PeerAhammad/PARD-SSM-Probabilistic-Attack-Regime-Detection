import { useMemo, useState } from 'react'
import { Database, Download, FileText, Gauge, Play, ShieldAlert, ShieldCheck, Timer, Upload } from 'lucide-react'
import { Badge, Banner, Card, CHART, ChartCard, Confusion, Donut, H2, Hist, Segmented, Spinner, Stat, TONES } from '../ui'
import { downloadCSV, f3 } from '../lib'

const DS: [string, string][] = [['cicids2017', 'CICIDS2017'], ['unswnb15', 'UNSW-NB15']]
const PAGE = 20
const METRICS: [string, string, string][] = [['Precision', 'precision', 'blue'], ['Recall', 'recall', 'teal'], ['F1', 'f1', 'violet'], ['FPR', 'fpr', 'amber'], ['ROC-AUC', 'roc_auc', 'pink'], ['PR-AUC', 'pr_auc', 'blue']]

export default function LiveDemo({ app }: any) {
  const [ds, setDs] = useState('cicids2017')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [drag, setDrag] = useState(false)
  const [page, setPage] = useState(0)
  const [filter, setFilter] = useState('all')
  const info = (app.demo?.datasets ?? []).find((d: any) => d.id === ds)
  const res = app.results[ds]
  const unavailable = info && info.available === false
  const canRun = !busy && !unavailable && app.mode !== 'connecting' && !!info
  const live = app.mode === 'live'

  const run = async (f?: File) => {
    setBusy(true); setErr(''); setPage(0)
    try { await app.run(ds, f) } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }
  const onDrop = (e: any) => {
    e.preventDefault(); setDrag(false)
    if (!live) return
    const f = e.dataTransfer.files?.[0]
    if (f) setFile(f)
  }

  const rows = useMemo(() => !res ? [] : res.predictions.filter((r: any) =>
    filter === 'all' || (filter === 'attack' ? r.predicted === 1 : r.predicted === 0)), [res, filter])

  const hist = useMemo(() => {
    if (!res) return []
    const b = Array(10).fill(0)
    res.predictions.forEach((r: any) => { b[Math.min(9, Math.floor(r.attack_probability * 10))]++ })
    return b.map((n: number, i: number) => ({
      bin: `${(i / 10).toFixed(1)}–${((i + 1) / 10).toFixed(1)}`, n,
      color: (i + 0.5) / 10 >= res.threshold ? CHART.coral : CHART.lagoon,
    }))
  }, [res])

  const ev = res?.evaluation
  const hasLabel = res?.predictions?.[0]?.label !== undefined

  return (
    <div className="space-y-6">
      <H2 eyebrow="Inference" sub="Runs the actual trained pipeline on the selected dataset. Each dataset uses its own preprocessing and model.">Live Demo</H2>
      <Segmented options={DS} value={ds} onChange={(id: string) => { setDs(id); setErr(''); setFile(null) }} />

      {unavailable && <Banner tone="bad" title="Interactive inference is disabled for this dataset.">{info.reason}</Banner>}

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="border-t-4 border-t-ocean lg:col-span-2">
          <div className="flex items-center gap-3">
            <span className={`grid h-10 w-10 place-items-center rounded-xl ${TONES.blue.chip}`}><Play size={20} aria-hidden /></span>
            <div><div className="font-bold text-ink">Preloaded demo sample</div>
              <div className="text-xs text-ink2">{info?.demo_rows ? `${info.demo_rows.toLocaleString()} consecutive rows from the held-out test partition` : 'Held-out test rows'}</div></div>
          </div>
          <button disabled={!canRun} onClick={() => run()} className="btn btn-primary mt-5 w-full">
            {busy ? <><Spinner />Running…</> : <><Play size={16} aria-hidden />Run Detection</>}
          </button>
          <a href={`/samples/${ds}_demo_sample.csv`} download className="btn btn-soft mt-3 w-full"><Download size={16} aria-hidden />Download a compatible sample CSV</a>
        </Card>

        <Card className="border-t-4 border-t-orchid lg:col-span-3">
          <div className="flex items-center gap-3">
            <span className={`grid h-10 w-10 place-items-center rounded-xl ${TONES.violet.chip}`}><Upload size={20} aria-hidden /></span>
            <div><div className="font-bold text-ink">Upload your own CSV</div><div className="text-xs text-ink2">Validated against the {info?.name ?? 'dataset'} schema before inference</div></div>
          </div>
          <label onDragOver={(e) => { e.preventDefault(); if (live) setDrag(true) }} onDragLeave={() => setDrag(false)} onDrop={onDrop}
            className={`mt-4 flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition focus-within:outline focus-within:outline-[3px] focus-within:outline-ocean-deep
              ${!live ? 'cursor-not-allowed border-control bg-[#EEF2FA]' : drag ? 'cursor-pointer border-ocean-deep bg-ocean-tint' : 'cursor-pointer border-control bg-ocean-tint/50 hover:bg-ocean-tint'}`}>
            <input type="file" accept=".csv" className="sr-only" disabled={!live} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            {file ? <FileText size={26} className="text-ocean-ink" aria-hidden /> : <Upload size={26} className="text-ocean-ink" aria-hidden />}
            <div className="text-sm font-bold text-ink">{file ? file.name : 'Drop a CSV here, or click to browse'}</div>
            <div className="text-xs text-ink2">{file ? `${(file.size / 1024).toFixed(0)} KB` : 'Up to 5,000 rows and 10 MB'}</div>
          </label>
          <button disabled={!canRun || !file || !live} onClick={() => file && run(file)} className="btn btn-primary mt-4">
            {busy ? <><Spinner />Running…</> : <><Upload size={16} aria-hidden />Run on uploaded CSV</>}
          </button>
          {!live && <p className="mt-3 text-xs font-semibold text-sun-ink">Uploads need the live backend. {app.mode === 'connecting' ? 'Still connecting…' : 'The backend is offline.'}</p>}
        </Card>
      </div>
      {err && <Banner tone="bad" title="Could not run detection">{err}</Banner>}

      <details className="card group p-5 text-sm text-ink2">
        <summary className="cursor-pointer font-bold text-ink">Expected input schema and requirements</summary>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 leading-relaxed">
          <li>CSV with a header row containing exactly these {info?.n_features ?? '…'} feature columns (leading/trailing spaces in names are ignored); extra columns are ignored.</li>
          <li>All values numeric, finite and non-missing. Rows must be in capture order: the regime filter reads them as one sequence and starts fresh at row 1.</li>
          <li>Optional <span className="code">Label</span> column (0/1 or text, where BENIGN/Normal means benign) enables evaluation metrics.</li>
          <li>Up to 5,000 rows and 10 MB per request. Preprocessing (feature selection, standardisation) is applied by the server.</li>
          <li>The model is trained on {ds === 'cicids2017' ? 'CICIDS2017' : 'UNSW-NB15'} only; data from other sources or feature definitions will give meaningless output.</li>
          <li>The data has no flow identifier, so the row index is used.</li>
        </ul>
        <div className="mt-3 break-words rounded-xl bg-[#F1F4FC] p-3 text-xs leading-relaxed text-ink">{(info?.features ?? []).join(', ')}</div>
      </details>

      {res && (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <Stat label="Records processed" value={res.n_rows.toLocaleString()} tone="blue" icon={Database} />
            <Stat label="Predicted benign" value={res.summary.n_benign_pred.toLocaleString()} tone="teal" icon={ShieldCheck} />
            <Stat label="Predicted attack" value={res.summary.n_attack_pred.toLocaleString()} tone="red" icon={ShieldAlert} />
            <Stat label="Mean attack prob." value={f3(res.summary.mean_attack_probability)} tone="violet" icon={Gauge} />
            <Stat label="Processing time" value={`${res.summary.processing_ms} ms`} sub={res.source === 'demo' ? 'demo sample' : 'uploaded file'} tone="pink" icon={Timer} />
          </div>
          <Banner>An attack probability is a model output, not proof that a flow is malicious. Decision threshold: <b>{f3(res.threshold)}</b> (chosen on validation data).</Banner>

          <div className="grid gap-4 lg:grid-cols-5">
            <ChartCard title="Predicted classes" className="lg:col-span-2">
              <Donut total={res.n_rows} data={[{ name: 'Predicted benign', value: res.summary.n_benign_pred, color: CHART.lagoon }, { name: 'Predicted attack', value: res.summary.n_attack_pred, color: CHART.coral }]} />
              <div className="mt-3 flex flex-wrap justify-center gap-x-5 gap-y-1 text-xs font-semibold text-ink">
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: CHART.lagoon }} />Benign {res.summary.n_benign_pred.toLocaleString()}</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: CHART.coral }} />Attack {res.summary.n_attack_pred.toLocaleString()}</span>
              </div>
            </ChartCard>
            <ChartCard title="Attack probability distribution" sub="Teal bins fall below the decision threshold, coral bins above it." className="lg:col-span-3">
              <Hist data={hist} />
            </ChartCard>
          </div>

          <Card>
            <div className="mb-4 flex items-center gap-3"><div className="font-bold text-ink">Evaluation</div>{ev ? <Badge tone="teal">labels provided</Badge> : <Badge tone="amber">no labels</Badge>}</div>
            {ev ? (
              <div className="grid gap-6 lg:grid-cols-2">
                <Confusion c={ev.confusion} />
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {METRICS.map(([k, f, t]) => (
                    <div key={k} className={`rounded-xl p-3 ${TONES[t].tint}`}><div className="text-xs font-bold uppercase tracking-wider text-ink2">{k}</div><div className="mt-1 text-xl font-extrabold tabular-nums text-ink">{f3(ev[f])}</div></div>
                  ))}
                </div>
              </div>
            ) : <p className="text-sm text-ink2">No usable Label column, so evaluation metrics are not shown. Only prediction statistics are available.</p>}
          </Card>

          <Card>
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <div className="font-bold text-ink">Predictions</div>
              <label className="sr-only" htmlFor="flt">Filter predictions</label>
              <select id="flt" value={filter} onChange={(e) => { setFilter(e.target.value); setPage(0) }} className="field">
                <option value="all">All</option><option value="attack">Predicted attack</option><option value="benign">Predicted benign</option>
              </select>
              <button onClick={() => downloadCSV(res)} className="btn btn-soft ml-auto"><Download size={16} aria-hidden />Download predictions (CSV)</button>
            </div>
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead><tr><th>Flow (row)</th><th>Attack probability</th><th>Predicted class</th><th>Regime</th>{hasLabel && <th>True label</th>}</tr></thead>
                <tbody>
                  {rows.slice(page * PAGE, (page + 1) * PAGE).map((r: any) => (
                    <tr key={r.row}>
                      <td>{r.row}</td>
                      <td>{r.attack_probability.toFixed(4)}</td>
                      <td><Badge tone={r.predicted ? 'red' : 'teal'}>{r.predicted ? 'attack' : 'benign'}</Badge></td>
                      <td><Badge tone={r.regime === 1 ? 'blue' : 'violet'}>Regime {r.regime}</Badge></td>
                      {hasLabel && <td><Badge tone={r.label ? 'red' : 'teal'}>{r.label ? 'attack' : 'benign'}</Badge></td>}
                    </tr>))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex items-center gap-3 text-xs font-semibold text-ink2">
              <button disabled={page === 0} onClick={() => setPage(page - 1)} className="btn btn-soft !px-3 !py-1.5">Prev</button>
              <span>Page {page + 1} of {Math.max(1, Math.ceil(rows.length / PAGE))} ({rows.length.toLocaleString()} rows)</span>
              <button disabled={(page + 1) * PAGE >= rows.length} onClick={() => setPage(page + 1)} className="btn btn-soft !px-3 !py-1.5">Next</button>
            </div>
          </Card>

          {[...(res.notes ?? []), ...(res.warnings ?? [])].length > 0 &&
            <ul className="list-disc space-y-1 pl-5 text-xs leading-relaxed text-ink2">{[...(res.notes ?? []), ...(res.warnings ?? [])].map((n: string) => <li key={n}>{n}</li>)}</ul>}
        </>
      )}
    </div>
  )
}