import { AlertTriangle, BookOpen, Cpu, ExternalLink, FileText } from 'lucide-react'
import { Card, H2, Pipeline, TONES } from '../ui'
import { REPO } from '../lib'

const LIMITS = [
  'The original repository metrics come from randomly sampled, shuffled-order arrays that cannot be regenerated from the raw data with the repository\'s current loader. They are shown for transparency only.',
  'The new results use a single seed and a within-session chronological split (CICIDS2017: first 60% / next 20% / last 20% of each daily file; UNSW-NB15: the same over the whole Stime-sorted stream, 20-row embargo between splits). They do not test generalisation to unseen days or attack families.',
  'CICIDS2017 has no timestamp column, so file order is used as a capture-order proxy. UNSW-NB15 is ordered by its start-time field.',
  'Both datasets were de-duplicated and then systematically subsampled (every 47th row) to about 50k rows. Rare classes (e.g. Heartbleed, Infiltration) are largely or entirely absent, and the sampled stream is coarser than real traffic.',
  'The CICIDS2017 test partition contains only about 560 attack rows. UNSW-NB15 has about 2% attacks in training versus about 6% in test, and its attack share drops sharply after de-duplication; its threshold and precision are less reliable.',
  'The switching state-space parameters (A, Q, R, transition matrix) are hand-set, not learned. The regimes are neutral filter states, not validated attack families.',
  'The SSSM regime features do not improve on a Random Forest alone in the held-out evaluation.',
  'An attack probability is a model output, not a verified classification. The models are trained on 2015/2017 benchmark data and are not a production security tool.',
  'Early-detection performance is not claimed.',
]

const Title = ({ icon: Icon, tone, children }: any) => (
  <div className="mb-3 flex items-center gap-3">
    <span className={`grid h-10 w-10 place-items-center rounded-xl ${TONES[tone].chip}`}><Icon size={20} aria-hidden /></span>
    <div className="text-lg font-extrabold text-ink">{children}</div>
  </div>
)

export default function Methodology() {
  return (
    <div className="space-y-8">
      <H2 eyebrow="Method" sub="What the pipeline does, and where it falls short.">Methodology and Limitations</H2>

      <Card className="border-t-4 border-t-orchid">
        <Title icon={Cpu} tone="violet">Switching state-space model</Title>
        <p className="text-sm leading-relaxed text-ink2">A latent state evolves under one of several regimes, each with its own dynamics, and the observed (standardised) flow features are noisy views of that state:</p>
        <pre className="mt-3 overflow-x-auto rounded-xl border-l-4 border-orchid bg-[#F1F4FC] p-4 text-sm text-ink">{`x_t = A_{s_t} x_{t-1} + w_t        (latent dynamics, regime s_t)\ny_t = C_{s_t} x_t + v_t            (observation)`}</pre>
        <p className="mt-3 text-sm leading-relaxed text-ink2">Two regimes are used, each with a Kalman filter (A = 0.95 I, Q = 0.001 I and A = 1.5 I, Q = 0.5 I; C = I, R = 0.2 I). At each step the filters' observation likelihoods are combined with a fixed regime transition matrix (stay probabilities 0.90 and 0.85) to give a regime posterior, which is smoothed causally (α = 0.7). All parameters are set by hand.</p>
      </Card>

      <Card className="border-t-4 border-t-ocean">
        <Title icon={BookOpen} tone="blue">Pipeline</Title>
        <Pipeline />
        <ul className="mt-5 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-ink2">
          <li><b className="text-ink">Feature selection and normalisation:</b> SelectKBest (ANOVA F-score, 20 features) and standardisation, fitted on training data only.</li>
          <li><b className="text-ink">State estimation:</b> the 8 highest-scoring features, standardised, feed the Kalman bank. The filter starts fresh at the first row of every sequence.</li>
          <li><b className="text-ink">Regime-derived features:</b> two smoothed regime posteriors, plus first differences of the 20 selected features.</li>
          <li><b className="text-ink">Classification:</b> Random Forest (100 trees, depth 20, class-balanced) trained on a training set whose minority class is oversampled to parity.</li>
          <li><b className="text-ink">Decision threshold:</b> the probability maximising F1 on the validation split, then applied unchanged to the test split.</li>
          <li><b className="text-ink">Datasets:</b> CICIDS2017 (52 features) and UNSW-NB15 (38 features), each with its own selector, scaler, filter configuration, forest and threshold. A model never scores the other dataset.</li>
        </ul>
      </Card>

      <Card className="border-t-4 border-t-sun">
        <Title icon={AlertTriangle} tone="amber">Limitations</Title>
        <ol className="space-y-3">
          {LIMITS.map((l, i) => (
            <li key={l} className="flex gap-3 text-sm leading-relaxed text-ink">
              <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg text-xs font-extrabold ${TONES.amber.chip}`}>{i + 1}</span>{l}
            </li>
          ))}
        </ol>
      </Card>

      <Card className="border-t-4 border-t-lagoon">
        <Title icon={FileText} tone="teal">Reproducibility, citation and licence</Title>
        <p className="text-sm leading-relaxed text-ink2">Code and instructions: <a className="inline-flex items-center gap-1 font-bold text-ocean-ink underline" href={REPO} target="_blank" rel="noreferrer">{REPO}<ExternalLink size={13} aria-hidden /></a>. Train and export a dataset's pipeline with <span className="code">python scripts/export_artifacts.py --dataset cicids2017</span> (or <span className="code">unswnb15</span>); run the API with <span className="code">uvicorn backend.app.main:app</span>.</p>
        <p className="mt-3 text-sm leading-relaxed text-ink2">The method builds on the PARD-SSM paper (arXiv:2604.02299). Please cite that paper and the repository; the BibTeX entry is in the repository README. Datasets: CICIDS2017 (Canadian Institute for Cybersecurity, University of New Brunswick) and UNSW-NB15 (UNSW Canberra Cyber). Released under the Apache License 2.0.</p>
      </Card>
    </div>
  )
}