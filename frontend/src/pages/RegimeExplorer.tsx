import { useMemo, useState } from 'react'
import { Play } from 'lucide-react'
import { Badge, Banner, Card, CHART, ChartCard, H2, Segmented, SeriesChart, Spinner } from '../ui'
import { f3, thin } from '../lib'

const lg = (v: number) => Math.log10(Math.max(v, 1e-4))
const DEFAULT_REGIMES = [
  { id: 1, name: 'Regime 1', description: 'Low-noise, near-stationary dynamics (A = 0.95 I, Q = 0.001 I)' },
  { id: 2, name: 'Regime 2', description: 'High-gain, high-noise dynamics (A = 1.5 I, Q = 0.5 I)' },
]

export default function RegimeExplorer({ app }: any) {
  const [ds, setDs] = useState('cicids2017')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const res = app.results[ds]
  const regimes = app.demo?.regimes ?? DEFAULT_REGIMES

  const run = async () => {
    setBusy(true); setErr('')
    try { await app.run(ds) } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }

  const data = useMemo(() => {
    if (!res) return []
    const t = res.timeline
    const rows = t.attack_probability.map((p: number, i: number) => ({
      i, p,
      y: res.predictions[i].label,
      r1: t.regime_posterior.regime_1[i], r2: t.regime_posterior.regime_2[i],
      x1: lg(t.latent_state_norm.regime_1[i]), x2: lg(t.latent_state_norm.regime_2[i]),
      u1: lg(t.state_uncertainty_trace.regime_1[i]), u2: lg(t.state_uncertainty_trace.regime_2[i]),
    }))
    return thin(rows, 800)
  }, [res])

  const rs = res?.regime_summary
  const hasLabel = res?.predictions?.[0]?.label !== undefined
  const R1 = { key: 'r1', name: 'Regime 1', color: CHART.ocean }
  const R2 = { key: 'r2', name: 'Regime 2', color: CHART.orchid }

  return (
    <div className="space-y-6">
      <H2 eyebrow="Switching state-space model" sub="Outputs of the Switching State-Space Model on the demo sample (or the last upload) for each dataset.">Regime Explorer</H2>
      <div className="flex flex-wrap items-center gap-3">
        <Segmented options={[['cicids2017', 'CICIDS2017'], ['unswnb15', 'UNSW-NB15']]} value={ds} onChange={(id: string) => { setDs(id); setErr('') }} />
        {!res && <button disabled={busy || app.mode === 'connecting'} onClick={run} className="btn btn-primary">{busy ? <><Spinner />Running…</> : <><Play size={16} aria-hidden />Run on demo sample</>}</button>}
      </div>
      {err && <Banner tone="bad" title="Could not run the filter">{err}</Banner>}

      <Banner tone="warn" title="Regimes are neutral filter states, not attack families.">
        They are defined by hand-set dynamics and were not learned from labels or validated against attack types.
      </Banner>

      <div className="grid gap-4 md:grid-cols-2">
        {regimes.map((r: any, i: number) => (
          <Card key={r.id} className={`border-t-4 ${i === 0 ? 'border-t-ocean' : 'border-t-orchid'}`}>
            <Badge tone={i === 0 ? 'blue' : 'violet'}>{r.name}</Badge>
            <p className="mt-2 text-sm leading-relaxed text-ink">{r.description}</p>
          </Card>
        ))}
      </div>

      {res && (
        <>
          <ChartCard title="Attack probability over sequential observations" sub={`Amber dashed line: decision threshold (${f3(res.threshold)}).`}>
            <SeriesChart data={data} yDomain={[0, 1]} refY={res.threshold} xLabel="row (capture order)"
              series={[{ key: 'p', name: 'attack probability', color: CHART.oceanDeep }, ...(hasLabel ? [{ key: 'y', name: 'true label (1 = attack)', color: CHART.coral, dashed: true }] : [])]} />
          </ChartCard>
          <ChartCard title="Probabilistic regime assignment" sub="Causally smoothed regime posterior at each observation.">
            <SeriesChart data={data} yDomain={[0, 1]} xLabel="row (capture order)" series={[R1, R2]} />
          </ChartCard>
          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="Latent state magnitude" sub="log10 of the state-estimate norm for each regime's filter.">
              <SeriesChart data={data} xLabel="row" series={[{ ...R1, key: 'x1' }, { ...R2, key: 'x2' }]} />
            </ChartCard>
            <ChartCard title="State uncertainty" sub="log10 of the trace of each filter's covariance matrix.">
              <SeriesChart data={data} xLabel="row" series={[{ ...R1, key: 'u1' }, { ...R2, key: 'u2' }]} />
            </ChartCard>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="Regime transition counts" sub="Most likely regime on consecutive rows.">
              <table className="tbl">
                <thead><tr><th>from \ to</th><th>Regime 1</th><th>Regime 2</th></tr></thead>
                <tbody>{rs.transitions.map((r: number[], i: number) => (
                  <tr key={i}><td><Badge tone={i === 0 ? 'blue' : 'violet'}>Regime {i + 1}</Badge></td>{r.map((c, j) => <td key={j}>{c.toLocaleString()}</td>)}</tr>))}
                </tbody>
              </table>
            </ChartCard>
            <ChartCard title="Regime summary">
              <table className="tbl">
                <thead><tr><th>Regime</th><th>Rows</th><th>Mean attack prob.</th>{hasLabel && <th>True attack share</th>}</tr></thead>
                <tbody>{[0, 1].map((k) => (
                  <tr key={k}>
                    <td><Badge tone={k === 0 ? 'blue' : 'violet'}>Regime {k + 1}</Badge></td><td>{rs.counts[k].toLocaleString()}</td>
                    <td>{rs.mean_attack_probability[k] === null ? 'n/a' : f3(rs.mean_attack_probability[k])}</td>
                    {hasLabel && <td>{rs.vs_label?.[k]?.true_attack_share == null ? 'n/a' : f3(rs.vs_label[k].true_attack_share)}</td>}
                  </tr>))}
                </tbody>
              </table>
            </ChartCard>
          </div>
          <p className="text-xs leading-relaxed text-ink2">The hybrid classifier receives the two smoothed regime posteriors as extra features. On the held-out evaluation these features carry signal alone but do not improve on a Random Forest without them (see Results).</p>
        </>
      )}
    </div>
  )
}