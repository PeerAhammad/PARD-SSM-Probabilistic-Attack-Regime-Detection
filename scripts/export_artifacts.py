import argparse, json, sys
from pathlib import Path
import joblib, numpy as np, pandas as pd, sklearn
from sklearn.metrics import roc_auc_score
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from src.data_processing.loaders_v2 import load_groups, split_segments
from src.pipeline import hybrid as H


def pick_demo(segs, n=1500, target=0.25):
    n = min(n, max(len(s[1]) for s in segs))
    best = None
    for name, X, y, lab in segs:
        if len(X) < n:
            continue
        c = np.concatenate([[0], np.cumsum(y)])
        cnt = c[n:] - c[:-n]
        i = int(np.argmin(np.abs(cnt - target * n)))
        sc = abs(cnt[i] - target * n)
        if best is None or sc < best[0]:
            best = (sc, name, X[i:i + n], y[i:i + n])
    return best[1], best[2], best[3]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dataset", choices=["cicids2017", "unswnb15"], required=True)
    ap.add_argument("--raw", default="data/raw")
    ap.add_argument("--stride", type=int, default=47)
    ap.add_argument("--trees", type=int, default=100)
    ap.add_argument("--out", default="artifacts")
    a = ap.parse_args()
    out = Path(a.out) / a.dataset
    out.mkdir(parents=True, exist_ok=True)

    print(f"Loading {a.dataset} ...")
    groups, feats = load_groups(a.dataset, a.raw, a.stride)
    sp = split_segments(groups)
    ys = {k: np.concatenate([s[2] for s in v]) for k, v in sp.items()}
    labs_te = np.concatenate([s[3] for s in sp["test"]])
    for k in sp:
        print(f"  {k}: {len(ys[k]):,} rows, attack rate {ys[k].mean():.3f}, {len(sp[k])} segment(s)")

    art = H.fit_preprocessing(np.vstack([s[1] for s in sp["train"]]), ys["train"])
    F = {k: [H.segment_features(s[1], art) for s in v] for k, v in sp.items()}
    mat = lambda split, keys: np.vstack([H.stack(f, keys) for f in F[split]])

    results, hybrid = {}, None
    for name, keys in H.VARIANTS.items():
        Xb, yb = H.oversample(mat("train", keys), ys["train"])
        rf = H.make_rf(a.trees).fit(Xb, yb)
        thr = H.best_threshold(ys["val"], rf.predict_proba(mat("val", keys))[:, 1])
        pt = rf.predict_proba(mat("test", keys))[:, 1]
        results[name] = H.metrics_block(ys["test"], pt, thr, curves=(name == "hybrid"))
        if name == "hybrid":
            hybrid = (rf, thr, pt)
    rf, thr, pt = hybrid
    art["rf"] = rf

    smooth_te = np.vstack([f["smooth"] for f in F["test"]])[:, 1]
    pred = pt >= thr
    families = {str(l): {"n": int((labs_te == l).sum()), "flagged_rate": round(float(pred[labs_te == l].mean()), 4)}
                for l in np.unique(labs_te)}

    sel_names = [feats[i] for i in np.flatnonzero(art["selector"].get_support())]
    ssm_names = [feats[i] for i in art["top_idx"]]
    joblib.dump(art["selector"], out / "feature_selector.joblib")
    joblib.dump({"rf": art["rf_scaler"], "sssm": art["sssm_scaler"]}, out / "scaler.joblib")
    joblib.dump(rf, out / "random_forest.joblib", compress=3)
    joblib.dump({"top_idx": art["top_idx"], "prior_attack": art["prior_attack"], "alpha": H.ALPHA,
                 "p_stay_normal": H.P_STAY_NORMAL, "p_stay_attack": H.P_STAY_ATTACK,
                 "kf1": {"A": 0.95, "Q": 0.001}, "kf2": {"A": 1.5, "Q": 0.5}, "R": 0.2, "C": "identity",
                 "note": "all Kalman parameters are hand-set, not learned"}, out / "switching_ssm.joblib")
    (out / "threshold.json").write_text(json.dumps({"threshold": thr, "selected_on": "validation split, max F1"}, indent=2))
    (out / "feature_schema.json").write_text(json.dumps({
        "dataset": a.dataset, "features": feats, "n_features": len(feats), "label_column_optional": "Label",
        "rows_must_be_in_capture_order": True, "rf_selected_features": sel_names, "sssm_features": ssm_names}, indent=2))
    (out / "model_config.json").write_text(json.dumps({
        "pipeline": "SelectKBest(20) -> StandardScaler; top-8 features -> 2-regime Kalman bank (hand-set) -> causal smoothing -> [rf, diff, smooth] -> RandomForest",
        "rf": {"n_estimators": a.trees, "max_depth": 20, "min_samples_split": 5, "class_weight": "balanced"},
        "oversampling": "minority upsampled to majority, train only",
        "sampling": f"systematic 1-in-{a.stride} of the ordered stream after within-file de-duplication",
        "split": "chronological 60/20/20 per capture group, 20-row embargo",
        "ssm_state": "fresh filter state at the start of every segment / upload",
        "versions": {"sklearn": sklearn.__version__, "numpy": np.__version__, "pandas": pd.__version__}}, indent=2))
    (out / "metrics.json").write_text(json.dumps({
        "dataset": a.dataset, "rows": {k: int(len(v)) for k, v in ys.items()},
        "attack_rate": {k: round(float(v.mean()), 4) for k, v in ys.items()},
        "variants": results, "sssm_alone_roc_auc": float(roc_auc_score(ys["test"], smooth_te)),
        "per_family_flagged_rate": families, "lead_time": None,
        "notes": ["Held-out test partition; threshold chosen on validation.",
                  "Lead time not reported: no validated temporal early-detection experiment."]}, indent=2))

    name, Xd, yd = pick_demo(sp["test"])
    pd.DataFrame(Xd, columns=feats).assign(Label=yd).to_csv(out / "demo_sample.csv", index=False)
    print(f"demo_sample.csv: {len(yd)} contiguous rows from {name}, {int(yd.sum())} attack (window picked for a benign/attack mix)")

    art2 = H.load_artifacts(out)
    p2 = np.concatenate([H.predict_segment(art2, s[1])[0] for s in sp["test"]])
    assert np.allclose(p2, pt, atol=1e-9), "reloaded pipeline does not reproduce test predictions"
    print("VERIFY OK: reloaded artifacts reproduce the held-out predictions exactly")

    print(f"\n{'variant':10s} {'recall':>7s} {'prec':>7s} {'f1':>7s} {'fpr':>7s} {'roc':>7s} {'pr':>7s}")
    for k, m in results.items():
        print(f"{k:10s} {m['recall']:7.3f} {m['precision']:7.3f} {m['f1']:7.3f} {m['fpr']:7.3f} {m['roc_auc']:7.3f} {m['pr_auc']:7.3f}")
    print(f"SSSM-alone ROC-AUC: {roc_auc_score(ys['test'], smooth_te):.3f}   threshold: {thr:.3f}")
    for f in sorted(out.iterdir()):
        print(f"  {f.name:28s} {f.stat().st_size/1e6:7.2f} MB")


if __name__ == "__main__":
    main()