import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend, ReferenceLine,
  BarChart, Bar, Cell, PieChart, Pie,
} from 'recharts'
import { Info, AlertTriangle, XCircle, CheckCircle2, Loader2 } from 'lucide-react'

/* Chart colours: every mark is >= 3:1 against white */
export const CHART = {
  ocean: '#5479D5', oceanDeep: '#3F5EC2', lagoon: '#1F9F97', orchid: '#9B5ECB',
  coral: '#E0505A', amber: '#D08400', grid: '#E3E9F6', axis: '#46526E', ink: '#303B55',
}
const AXIS = { fill: CHART.axis, fontSize: 11 }
const TIP: any = {
  contentStyle: { background: '#fff', border: '1px solid #D3DCF0', borderRadius: 12, fontSize: 12, color: '#303B55', boxShadow: '0 12px 30px -12px rgba(48,59,85,.4)' },
  labelStyle: { color: '#303B55', fontWeight: 700 },
  itemStyle: { color: '#303B55' },
  cursor: { stroke: '#B9C8F2' },
}
const legendFmt = (v: string) => <span style={{ color: CHART.ink, fontWeight: 600 }}>{v}</span>

export const TONES: any = {
  blue:   { chip: 'bg-ocean-tint text-ocean-ink',   tint: 'bg-ocean-tint',   bar: 'border-t-ocean',  badge: 'bg-ocean-tint text-ocean-ink border-ocean/40' },
  teal:   { chip: 'bg-lagoon-tint text-lagoon-ink', tint: 'bg-lagoon-tint',  bar: 'border-t-lagoon', badge: 'bg-lagoon-tint text-lagoon-ink border-lagoon/50' },
  violet: { chip: 'bg-orchid-tint text-orchid-ink', tint: 'bg-orchid-tint',  bar: 'border-t-orchid', badge: 'bg-orchid-tint text-orchid-ink border-orchid/50' },
  pink:   { chip: 'bg-bubble-tint text-bubble-ink', tint: 'bg-bubble-tint',  bar: 'border-t-bubble', badge: 'bg-bubble-tint text-bubble-ink border-bubble/60' },
  amber:  { chip: 'bg-sun-tint text-sun-ink',       tint: 'bg-sun-tint',     bar: 'border-t-sun',    badge: 'bg-sun-tint text-sun-ink border-sun/60' },
  red:    { chip: 'bg-coral-tint text-coral-ink',   tint: 'bg-coral-tint',   bar: 'border-t-coral',  badge: 'bg-coral-tint text-coral-ink border-coral/50' },
}

export const Card = ({ children, className = '', lift = false, pad = true }: any) => (
  <div className={`card ${lift ? 'card-lift' : ''} ${pad ? 'p-5' : ''} ${className}`}>{children}</div>
)

export const ChartCard = ({ title, sub, children, className = '' }: any) => (
  <Card className={className}>
    <div className="mb-3">
      <div className="text-sm font-bold text-ink">{title}</div>
      {sub && <div className="mt-0.5 text-xs leading-relaxed text-ink2">{sub}</div>}
    </div>
    {children}
  </Card>
)

export const H2 = ({ children, sub, eyebrow }: any) => (
  <div className="mb-5">
    {eyebrow && <div className="mb-1 text-xs font-bold uppercase tracking-[0.14em] text-orchid-ink">{eyebrow}</div>}
    <h2 className="text-2xl font-extrabold tracking-tight text-ink">{children}</h2>
    {sub && <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-ink2">{sub}</p>}
  </div>
)

export const Stat = ({ label, value, sub, tone = 'blue', icon: Icon }: any) => {
  const t = TONES[tone]
  return (
    <div className={`card card-lift border-t-4 ${t.bar} p-5`}>
      <div className="flex items-start justify-between gap-3">
        <div className="text-xs font-bold uppercase tracking-wider text-ink3">{label}</div>
        {Icon && <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${t.chip}`}><Icon size={18} aria-hidden /></span>}
      </div>
      <div className="mt-3 text-3xl font-extrabold tracking-tight text-ink tabular-nums">{value}</div>
      {sub && <div className="mt-1 text-xs text-ink2">{sub}</div>}
    </div>
  )
}

const BANNERS: any = {
  info: [Info, 'bg-ocean-tint border-ocean/40', 'text-ocean-ink'],
  warn: [AlertTriangle, 'bg-sun-tint border-sun/60', 'text-sun-ink'],
  bad: [XCircle, 'bg-coral-tint border-coral/50', 'text-coral-ink'],
  good: [CheckCircle2, 'bg-lagoon-tint border-lagoon/50', 'text-lagoon-ink'],
}
export const Banner = ({ tone = 'info', title, children }: any) => {
  const [Icon, box, ic] = BANNERS[tone]
  return (
    <div role={tone === 'bad' ? 'alert' : 'status'} className={`flex gap-3 rounded-2xl border px-4 py-3 text-sm leading-relaxed text-ink ${box}`}>
      <Icon size={18} className={`mt-0.5 shrink-0 ${ic}`} aria-hidden />
      <div>{title && <div className={`font-bold ${ic}`}>{title}</div>}{children}</div>
    </div>
  )
}

export const Badge = ({ tone = 'blue', children, className = '' }: any) => (
  <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-bold ${TONES[tone].badge} ${className}`}>{children}</span>
)

export const Spinner = ({ size = 16 }: any) => <Loader2 size={size} className="animate-spin" aria-hidden />

export const Segmented = ({ options, value, onChange }: any) => (
  <div role="tablist" className="inline-flex rounded-xl border border-control bg-white p-1 shadow-soft">
    {options.map(([id, name]: any) => (
      <button key={id} role="tab" aria-selected={value === id} onClick={() => onChange(id)}
        className={`rounded-lg px-4 py-2 text-sm font-bold transition ${value === id ? 'bg-ocean-deep text-white shadow-md' : 'text-ink2 hover:bg-ocean-tint hover:text-ocean-ink'}`}>{name}</button>
    ))}
  </div>
)

const STEPS = [
  ['Network flows', 'CSV of flow features, in capture order'],
  ['Preprocess', 'SelectKBest (20 features) + standardisation, fitted on training data only'],
  ['Regime filter', 'Two-regime Kalman bank on the 8 top-ranked features'],
  ['Hybrid features', '20 features + 20 temporal differences + 2 regime posteriors'],
  ['Random Forest', 'Class-balanced, trained on oversampled training data'],
  ['Threshold', 'Chosen on the validation split (maximum F1)'],
  ['Prediction', 'Attack probability, predicted class and regime'],
]
const STEP_TONES = ['blue', 'teal', 'violet', 'pink', 'blue', 'teal', 'violet']
export const Pipeline = () => (
  <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
    {STEPS.map(([t, d], i) => {
      const tn = TONES[STEP_TONES[i]]
      return (
        <li key={t} className={`card card-lift border-t-4 ${tn.bar} p-4`}>
          <span className={`grid h-7 w-7 place-items-center rounded-lg text-xs font-extrabold ${tn.chip}`}>{i + 1}</span>
          <div className="mt-2 text-sm font-bold text-ink">{t}</div>
          <div className="mt-1 text-xs leading-relaxed text-ink2">{d}</div>
        </li>
      )
    })}
  </ol>
)

export const Confusion = ({ c }: any) => {
  const cell = (n: number, lab: string, full: string, cls: string) => (
    <div className={`rounded-xl border p-3 text-center ${cls}`}>
      <div className="text-xl font-extrabold tabular-nums text-ink">{n.toLocaleString()}</div>
      <div className="text-xs font-semibold text-ink2">{lab} · {full}</div>
    </div>
  )
  const side = (t: string) => <div className="grid place-items-center pr-1 text-right text-xs font-semibold text-ink2">{t}</div>
  return (
    <div className="grid max-w-md grid-cols-[4.5rem_1fr_1fr] gap-2">
      <div />
      <div className="pb-1 text-center text-xs font-semibold text-ink2">Predicted benign</div>
      <div className="pb-1 text-center text-xs font-semibold text-ink2">Predicted attack</div>
      {side('Actual benign')}
      {cell(c.tn, 'TN', 'correct benign', 'border-lagoon/50 bg-lagoon-tint')}
      {cell(c.fp, 'FP', 'false alarm', 'border-sun/60 bg-sun-tint')}
      {side('Actual attack')}
      {cell(c.fn, 'FN', 'missed attack', 'border-coral/50 bg-coral-tint')}
      {cell(c.tp, 'TP', 'detected attack', 'border-lagoon/50 bg-lagoon-tint')}
    </div>
  )
}

export const SeriesChart = ({ data, series, xKey = 'i', yDomain, refY, diagonal, height = 250, numericX = false, xLabel = '' }: any) => (
  <div style={{ height }}>
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 14, left: 0, bottom: xLabel ? 18 : 6 }}>
        <CartesianGrid stroke={CHART.grid} vertical={false} />
        <XAxis dataKey={xKey} type={numericX ? 'number' : 'category'} domain={numericX ? [0, 1] : undefined}
               tick={AXIS} axisLine={{ stroke: '#B9C4DE' }} tickLine={false} minTickGap={36}
               label={xLabel ? { value: xLabel, position: 'insideBottom', offset: -10, fill: CHART.axis, fontSize: 11 } : undefined} />
        <YAxis tick={AXIS} axisLine={false} tickLine={false} domain={yDomain ?? ['auto', 'auto']} width={44} />
        <Tooltip {...TIP} />
        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 6 }} formatter={legendFmt} />
        {refY !== undefined && <ReferenceLine y={refY} stroke={CHART.amber} strokeDasharray="5 4" strokeWidth={1.5} />}
        {diagonal && <ReferenceLine segment={[{ x: 0, y: 0 }, { x: 1, y: 1 }]} stroke="#8A97B8" strokeDasharray="4 4" />}
        {series.map((s: any) => (
          <Line key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} dot={false}
                strokeWidth={2.25} strokeDasharray={s.dashed ? '5 4' : undefined} isAnimationActive={false} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  </div>
)

export const GroupedBars = ({ data, bars, height = 270 }: any) => (
  <div style={{ height }}>
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 4 }} barGap={4}>
        <CartesianGrid stroke={CHART.grid} vertical={false} />
        <XAxis dataKey="name" tick={AXIS} axisLine={{ stroke: '#B9C4DE' }} tickLine={false} />
        <YAxis domain={[0, 1]} tick={AXIS} axisLine={false} tickLine={false} width={36} />
        <Tooltip {...TIP} cursor={{ fill: 'rgba(84,121,213,.08)' }} formatter={(v: any) => (typeof v === 'number' ? v.toFixed(3) : v)} />
        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 6 }} formatter={legendFmt} />
        {bars.map((b: any) => <Bar key={b.key} dataKey={b.key} name={b.name} fill={b.color} radius={[6, 6, 0, 0]} isAnimationActive={false} />)}
      </BarChart>
    </ResponsiveContainer>
  </div>
)

export const Hist = ({ data, height = 230 }: any) => (
  <div style={{ height }}>
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 6, right: 8, left: 0, bottom: 4 }}>
        <CartesianGrid stroke={CHART.grid} vertical={false} />
        <XAxis dataKey="bin" tick={{ ...AXIS, fontSize: 10 }} axisLine={{ stroke: '#B9C4DE' }} tickLine={false} />
        <YAxis tick={AXIS} axisLine={false} tickLine={false} width={40} allowDecimals={false} />
        <Tooltip {...TIP} cursor={{ fill: 'rgba(84,121,213,.08)' }} />
        <Bar dataKey="n" name="rows" radius={[6, 6, 0, 0]} isAnimationActive={false}>
          {data.map((d: any) => <Cell key={d.bin} fill={d.color} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  </div>
)

export const Donut = ({ data, total, height = 210 }: any) => (
  <div className="relative" style={{ height }}>
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="90%" paddingAngle={2} stroke="#fff" strokeWidth={2} isAnimationActive={false}>
          {data.map((d: any) => <Cell key={d.name} fill={d.color} />)}
        </Pie>
        <Tooltip {...TIP} />
      </PieChart>
    </ResponsiveContainer>
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
      <div className="text-2xl font-extrabold tabular-nums text-ink">{total.toLocaleString()}</div>
      <div className="text-xs font-semibold text-ink2">rows</div>
    </div>
  </div>
)