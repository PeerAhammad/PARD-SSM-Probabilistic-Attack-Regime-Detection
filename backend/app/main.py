"""PARD-SSM Explorer API (stateless). Run from the repo root:  uvicorn backend.app.main:app"""
import io
import json
import os
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from src.pipeline import hybrid as H

ROOT = Path(__file__).resolve().parents[2]
ART = Path(os.getenv("ARTIFACT_DIR", ROOT / "artifacts"))
NAMES = {"cicids2017": "CICIDS2017", "unswnb15": "UNSW-NB15"}
MAX_BYTES, MAX_ROWS = 10_000_000, 5_000
BENIGN = {"BENIGN", "NORMAL", "0", "0.0"}
REGIMES = [
    {"id": 1, "name": "Regime 1", "description": "Low-noise, near-stationary dynamics (A = 0.95 I, Q = 0.001 I)"},
    {"id": 2, "name": "Regime 2", "description": "High-gain, high-noise dynamics (A = 1.5 I, Q = 0.5 I)"},
]
MODELS = {}


@asynccontextmanager
async def lifespan(app):
    for key in NAMES:
        d = ART / key
        try:
            art = H.load_artifacts(d)
            art["rf"].n_jobs = 1
            demo_rows = sum(1 for _ in open(d / "demo_sample.csv", encoding="utf-8")) - 1
            MODELS[key] = {"art": art, "dir": d, "error": None, "demo_rows": demo_rows,
                           "schema": json.loads((d / "feature_schema.json").read_text()),
                           "metrics": json.loads((d / "metrics.json").read_text()),
                           "config": json.loads((d / "model_config.json").read_text())}
        except Exception as e:  # a broken dataset must not take the whole API down
            MODELS[key] = {"error": f"{type(e).__name__}: {e}"}
    yield


app = FastAPI(title="PARD-SSM Explorer API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",") if o.strip()],
    allow_methods=["GET", "POST"], allow_headers=["*"],
)


def get_model(key):
    if key not in NAMES:
        raise HTTPException(422, f"Unknown dataset '{key}'. Use one of: {', '.join(NAMES)}.")
    m = MODELS.get(key)
    if not m or m.get("error"):
        raise HTTPException(503, f"The {NAMES[key]} model is unavailable: {(m or {}).get('error', 'not loaded')}")
    return m


def read_frame(raw, schema):
    if not raw.strip():
        raise HTTPException(422, "The file is empty.")
    try:
        df = pd.read_csv(io.BytesIO(raw), nrows=MAX_ROWS + 1, low_memory=False, encoding="latin-1")
    except Exception as e:
        raise HTTPException(400, f"Could not parse the file as CSV: {e}")
    df.columns = df.columns.astype(str).str.strip()
    if len(df) == 0:
        raise HTTPException(422, "The CSV has a header but no data rows.")
    if len(df) > MAX_ROWS:
        raise HTTPException(422, f"At most {MAX_ROWS:,} rows are accepted per request.")
    feats = schema["features"]
    missing = [c for c in feats if c not in df.columns]
    if missing:
        raise HTTPException(422, f"Missing {len(missing)} of {len(feats)} required columns, e.g. {missing[:8]}. "
                                 "The first row must be a header with the exact feature names.")
    X = df[feats].apply(pd.to_numeric, errors="coerce").to_numpy(dtype=float)
    bad = ~np.isfinite(X)
    if bad.any():
        cols = [feats[i] for i in np.flatnonzero(bad.any(axis=0))]
        raise HTTPException(422, f"{int(bad.any(axis=1).sum())} row(s) have missing, non-numeric or infinite values "
                                 f"in: {cols[:8]}. Rows are not dropped silently because order matters.")
    y = None
    if "Label" in df.columns:
        num = pd.to_numeric(df["Label"], errors="coerce")
        y = ((num != 0).astype(int) if num.notna().all()
             else ~df["Label"].astype(str).str.strip().str.upper().isin(BENIGN)).astype(int).to_numpy()
    extra = [c for c in df.columns if c not in feats and c != "Label"]
    return X, y, extra


@app.get("/api/health")
def health():
    return {"status": "ok", "datasets": {k: bool(MODELS.get(k)) and not MODELS[k].get("error") for k in NAMES},
            "errors": {k: MODELS[k]["error"] for k in NAMES if MODELS.get(k, {}).get("error")}}


@app.get("/api/demo")
def demo():
    out = []
    for key, name in NAMES.items():
        m = MODELS.get(key) or {}
        if not m or m.get("error"):
            out.append({"id": key, "name": name, "available": False, "reason": m.get("error", "not loaded")})
            continue
        out.append({"id": key, "name": name, "available": True, "n_features": m["schema"]["n_features"],
                    "features": m["schema"]["features"], "rf_selected_features": m["schema"]["rf_selected_features"],
                    "sssm_features": m["schema"]["sssm_features"], "threshold": m["art"]["threshold"],
                    "demo_rows": m["demo_rows"], "metrics": m["metrics"], "config": m["config"]})
    return {"datasets": out, "regimes": REGIMES, "limits": {"max_rows": MAX_ROWS, "max_file_mb": MAX_BYTES / 1e6}}


@app.post("/api/predict")
def predict(dataset: str = Form(...), use_demo: bool = Form(False), file: Optional[UploadFile] = File(None)):
    m = get_model(dataset)
    if use_demo:
        raw, source = (m["dir"] / "demo_sample.csv").read_bytes(), "demo"
    elif file is not None:
        raw, source = file.file.read(MAX_BYTES + 1), "upload"
        if len(raw) > MAX_BYTES:
            raise HTTPException(413, f"File is larger than {MAX_BYTES // 1_000_000} MB.")
    else:
        raise HTTPException(422, "Upload a CSV file or set use_demo=true.")

    X, y, extra = read_frame(raw, m["schema"])
    t0 = time.perf_counter()
    p, f = H.predict_segment(m["art"], X)
    ms = (time.perf_counter() - t0) * 1000

    thr = m["art"]["threshold"]
    pred = (p >= thr).astype(int)
    regime = np.argmax(f["smooth"], axis=1)
    trans = np.zeros((2, 2), dtype=int)
    np.add.at(trans, (regime[:-1], regime[1:]), 1)
    r4 = lambda a: np.round(a, 4).tolist()

    rows = [{"row": i, "attack_probability": round(float(p[i]), 4), "predicted": int(pred[i]),
             "regime": int(regime[i]) + 1} for i in range(len(p))]
    if y is not None:
        for i, r in enumerate(rows):
            r["label"] = int(y[i])

    evaluation, regime_vs_label, notes = None, None, [
        "attack_probability is a model output, not a verified classification.",
        "Rows are treated as one ordered sequence; the regime filter starts from a fresh state at row 1.",
        "The row index is the flow identifier: the supported schemas contain no flow ID.",
        "Regimes are neutral filter states with hand-set dynamics; they are not attack families."]
    warnings = []
    if y is not None:
        if y.min() == y.max():
            notes.append("The Label column has a single class, so evaluation metrics were not computed.")
        else:
            evaluation = H.metrics_block(y, p, thr, curves=True)
        regime_vs_label = [{"regime": k + 1, "n": int((regime == k).sum()),
                            "true_attack_share": round(float(y[regime == k].mean()), 4) if (regime == k).any() else None}
                           for k in (0, 1)]
    if extra:
        warnings.append(f"{len(extra)} column(s) not in the model schema were ignored.")
    warnings.append("The models were trained on a 1-in-k subsampled, time-ordered stream; dense captures may "
                    "behave differently.")

    return {
        "dataset": dataset, "dataset_name": NAMES[dataset], "source": source, "n_rows": len(p), "threshold": thr,
        "summary": {"n_benign_pred": int((pred == 0).sum()), "n_attack_pred": int(pred.sum()),
                    "attack_rate_pred": round(float(pred.mean()), 4), "mean_attack_probability": round(float(p.mean()), 4),
                    "processing_ms": round(ms, 1)},
        "predictions": rows,
        "timeline": {"attack_probability": r4(p),
                     "regime_posterior": {"regime_1": r4(f["smooth"][:, 0]), "regime_2": r4(f["smooth"][:, 1])},
                     "latent_state_norm": {"regime_1": r4(f["xnorm"][:, 0]), "regime_2": r4(f["xnorm"][:, 1])},
                     "state_uncertainty_trace": {"regime_1": r4(f["ptrace"][:, 0]), "regime_2": r4(f["ptrace"][:, 1])}},
        "regime_summary": {"counts": [int((regime == 0).sum()), int((regime == 1).sum())],
                           "transitions": trans.tolist(),
                           "mean_attack_probability": [round(float(p[regime == k].mean()), 4) if (regime == k).any() else None
                                                       for k in (0, 1)],
                           "vs_label": regime_vs_label, "definitions": REGIMES},
        "evaluation": evaluation, "notes": notes, "warnings": warnings,
    }