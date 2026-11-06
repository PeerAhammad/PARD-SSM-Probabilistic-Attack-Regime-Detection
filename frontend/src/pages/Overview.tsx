import { Activity, BarChart3, Cpu, Database, ExternalLink, Gauge, Info, Layers, ShieldCheck } from 'lucide-react'
import { Badge, Banner, Card, H2, Pipeline, Stat, TONES } from '../ui'
import { REPORTED } from '../reported'
import { REPO, f3 } from '../lib'

export default function Overview({ app }: any) {
  const ds: any[] = app.demo?.datasets ?? []
  const info = [
    { t: 'The problem', tone: 'blue', icon: Info, d: 'Network flows are not independent events. Attack traffic changes the dynamics of the stream, but flow-by-flow classifiers ignore the order in which flows arrive.' },
    { t: 'The approach', tone: 'teal', icon: Layers, d: 'A bank of Kalman filters with different dynamics tracks which regime best explains the incoming sequence. Its regime probabilities become extra inputs to a Random Forest.' },
    { t: 'The honest finding', tone: 'violet', icon: Cpu, d: 'In our held-out, time-ordered evaluation the regime features carry signal on their own but do not beat a Random Forest alone. See Results.' },
  ]
  return (
    <div className="space-y-12">
      <section className="hero-bg relative overflow-hidden rounded-3xl p-8 shadow-lift sm:p-12">
        <div className="pointer-events-none absolute -right-20 -top-24 h-80 w-80 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-28 right-28 h-64 w-64 rounded-full bg-bubble/20" />
        <div className="relative max-w-3xl on-dark">
          <span className="glass inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.16em]">Research platform</span>
          <h1 className="mt-4 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">Understanding Network Threats Through Probabilistic Attack Regime Detection</h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed">
            PARD-SSM is an experimental network intrusion detection framework. It uses Switching State-Space Models to infer changing
            latent network behaviour, and combines the regime-derived information with Random Forest classification for attack detection.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a href="#/demo" className="btn btn-white">Explore the detection demo</a>
            <a href="#/results" className="btn btn-glass">View research results</a>
            <a href={REPO} target="_blank" rel="noreferrer" className="btn btn-glass"><ExternalLink size={16} aria-hidden />GitHub repository</a>
          </div>
        </div>
        <div className="relative mt-9 grid gap-3 sm:grid-cols-3 on-dark">
          {[['2 datasets', 'CICIDS2017 · UNSW-NB15'], ['Time-ordered evaluation', 'Chronological train / validation / test split'], ['Real inference', 'Exported models, no simulated predictions']].map(([a, b]) => (
            <div key={a} className="glass rounded-2xl p-4"><div className="font-extrabold">{a}</div><div className="mt-0.5 text-sm">{b}</div></div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {info.map(({ t, tone, icon: Icon, d }) => (
          <Card key={t} lift className={`border-t-4 ${TONES[tone].bar}`}>
            <span className={`grid h-10 w-10 place-items-center rounded-xl ${TONES[tone].chip}`}><Icon size={20} aria-hidden /></span>
            <div className="mt-3 font-bold text-ink">{t}</div>
            <p className="mt-1.5 text-sm leading-relaxed text-ink2">{d}</p>
          </Card>
        ))}
      </section>

      <section>
        <H2 eyebrow="Newly reproduced" sub="Time-ordered train / validation / test split, threshold chosen on validation, single seed. These are the numbers measured for this site.">Held-out results</H2>
        <div className="space-y-6">
          {ds.map((d) => {
            const v = d.metrics?.variants
            if (!v) return null
            return (
              <div key={d.id}>
                <div className="mb-3 flex items-center gap-3"><div className="text-lg font-extrabold text-ink">{d.name}</div><Badge tone="violet">held-out test</Badge></div>
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                  <Stat label="Hybrid F1" value={f3(v.hybrid.f1)} tone="blue" icon={Gauge} />
                  <Stat label="RF-only F1" value={f3(v.rf_only.f1)} tone="teal" icon={ShieldCheck} />
                  <Stat label="Hybrid recall" value={f3(v.hybrid.recall)} tone="violet" icon={Activity} />
                  <Stat label="Hybrid ROC-AUC" value={f3(v.hybrid.roc_auc)} tone="pink" icon={BarChart3} />
                </div>
              </div>
            )
          })}
        </div>
        <p className="mt-4 text-xs leading-relaxed text-ink2">Held-out test partition of the new pipeline, not live deployment performance. Detection lead time is not reported because no validated temporal early-detection experiment exists.</p>
      </section>

      <section>
        <H2 eyebrow="Repository-reported" >Original repository-reported results</H2>
        <Banner tone="warn">Reported experimental results from the research repository. They are not live performance and were not reproduced here.</Banner>
        <Card className="mt-4 overflow-x-auto">
          <table className="tbl">
            <thead><tr>{REPORTED.head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
            <tbody>{REPORTED.rows.map((r) => <tr key={r[0]}>{r.map((c, i) => <td key={i} className={i === 0 ? 'font-semibold' : ''}>{c}</td>)}</tr>)}</tbody>
          </table>
        </Card>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-xs leading-relaxed text-ink2">{REPORTED.caveats.map((c) => <li key={c}>{c}</li>)}</ul>
      </section>

      <section>
        <H2 eyebrow="Data">Supported datasets</H2>
        <div className="grid gap-4 md:grid-cols-2">
          {[['CICIDS2017', 'blue', `Canadian Institute for Cybersecurity intrusion dataset: five days of benign and attack traffic. ${ds[0]?.n_features ?? 52} flow features. Capture order is taken from file order within each daily file (there is no timestamp column).`],
            ['UNSW-NB15', 'teal', `UNSW Canberra hybrid of real normal and synthetic attack traffic. ${ds[1]?.n_features ?? 38} flow features. Rows are ordered by the dataset's start-time (Stime) field.`]].map(([n, tone, d]) => (
            <Card key={n} lift className={`border-t-4 ${TONES[tone].bar}`}>
              <div className="flex items-center gap-3"><span className={`grid h-10 w-10 place-items-center rounded-xl ${TONES[tone].chip}`}><Database size={20} aria-hidden /></span><div className="font-bold text-ink">{n}</div></div>
              <p className="mt-3 text-sm leading-relaxed text-ink2">{d}</p>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <H2 eyebrow="Pipeline" sub="Each dataset has its own selector, scaler, regime filter, Random Forest and threshold.">Architecture</H2>
        <Pipeline />
      </section>
    </div>
  )
}