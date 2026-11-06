"""Shared train/inference code for the PARD-SSM hybrid: SelectKBest -> 2-regime Kalman bank -> Random Forest."""
import json
from pathlib import Path
import joblib
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.feature_selection import SelectKBest, f_classif
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import (confusion_matrix, roc_curve, precision_recall_curve,
                             roc_auc_score, average_precision_score)

K_SELECT, K_SSSM, ALPHA = 20, 8, 0.7
P_STAY_NORMAL, P_STAY_ATTACK = 0.90, 0.85
VARIANTS = {"rf_only": ["rf"], "rf_diff": ["rf", "diff"], "hybrid": ["rf", "diff", "smooth"]}


class KalmanFilter:  # copied unchanged from src/models/switching_ssm.py
    def __init__(self, A, C, Q, R, x0, P0):
        self.A, self.C, self.Q, self.R = A, C, Q, R
        self.x, self.P = x0.copy(), P0.copy()

    def predict(self):
        self.x = self.A @ self.x
        self.P = self.A @ self.P @ self.A.T + self.Q

    def update(self, y):
        S = self.C @ self.P @ self.C.T + self.R
        S += np.eye(S.shape[0]) * 1e-6
        K = self.P @ self.C.T @ np.linalg.inv(S)
        diff = y - self.C @ self.x
        self.x = self.x + K @ diff
        I_KC = np.eye(self.P.shape[0]) - K @ self.C
        self.P = I_KC @ self.P @ I_KC.T + K @ self.R @ K.T
        sign, log_det_S = np.linalg.slogdet(S)
        log_det_S = max(log_det_S, -1e6)
        log_like = (-0.5 * float(diff.T @ np.linalg.inv(S) @ diff)
                    - 0.5 * log_det_S - 0.5 * y.shape[0] * np.log(2 * np.pi))
        return np.exp(np.clip(log_like, -500, 0))


class SwitchingStateSpaceModel:  # copied unchanged
    def __init__(self, filters, transition_matrix, prior=None):
        self.filters, self.M, self.T = filters, len(filters), transition_matrix
        self.regime_probs = prior if prior is not None else np.ones(self.M) / self.M

    def step(self, y):
        lik = np.zeros(self.M)
        for i, kf in enumerate(self.filters):
            kf.predict()
            lik[i] = kf.update(y)
        post = lik * (self.T.T @ self.regime_probs) + 1e-8
        self.regime_probs = post / post.sum()
        return self.regime_probs.copy()


def run_regimes(obs, prior_attack):
    """Fresh filter state per call. Returns regime posterior (T,2), latent-state norm (T,2), covariance trace (T,2)."""
    dim = obs.shape[1]
    I = np.eye(dim)
    kfs = [KalmanFilter(I * 0.95, I, I * 0.001, I * 0.2, np.zeros(dim), I),
           KalmanFilter(I * 1.5, I, I * 0.5, I * 0.2, np.zeros(dim), I)]
    T = np.array([[P_STAY_NORMAL, 1 - P_STAY_NORMAL], [1 - P_STAY_ATTACK, P_STAY_ATTACK]])
    model = SwitchingStateSpaceModel(kfs, T, prior=np.array([1 - prior_attack, prior_attack]))
    post, xn, tr = (np.empty((len(obs), 2)) for _ in range(3))
    for t, y in enumerate(obs):
        post[t] = model.step(y)
        for i, kf in enumerate(kfs):
            xn[t, i], tr[t, i] = np.linalg.norm(kf.x), np.trace(kf.P)
    return post, xn, tr


def causal_smooth(probs, alpha, seed=None):
    s = probs.copy().astype(float)
    s[0] = alpha * s[0] + (1 - alpha) * (seed if seed is not None else s[0])
    for i in range(1, len(s)):
        s[i] = alpha * s[i] + (1 - alpha) * s[i - 1]
    return s


def fit_preprocessing(X_tr, y_tr):
    selector = SelectKBest(f_classif, k=min(K_SELECT, X_tr.shape[1])).fit(X_tr, y_tr)
    scores = np.nan_to_num(selector.scores_, nan=-np.inf)      # constant columns give NaN scores
    top_idx = np.argsort(scores)[::-1][:min(K_SSSM, X_tr.shape[1])]
    return {"selector": selector,
            "rf_scaler": StandardScaler().fit(selector.transform(X_tr)),
            "sssm_scaler": StandardScaler().fit(X_tr[:, top_idx]),
            "top_idx": top_idx, "prior_attack": float(y_tr.mean())}


def segment_features(X, art):
    sel = art["rf_scaler"].transform(art["selector"].transform(X))
    post, xn, tr = run_regimes(art["sssm_scaler"].transform(X[:, art["top_idx"]]), art["prior_attack"])
    return {"rf": sel, "diff": np.diff(sel, axis=0, prepend=sel[0:1]), "smooth": causal_smooth(post, ALPHA),
            "posterior": post, "xnorm": xn, "ptrace": tr}


def stack(f, keys):
    return np.hstack([f[k] for k in keys])


def oversample(X, y, seed=42):
    rng = np.random.default_rng(seed)
    mn, mj = y == 1, y == 0
    idx = rng.choice(mn.sum(), size=mj.sum(), replace=True)
    return np.vstack([X[mj], X[mn][idx]]), np.hstack([y[mj], y[mn][idx]])


def make_rf(trees=100):
    return RandomForestClassifier(n_estimators=trees, max_depth=20, min_samples_split=5,
                                  class_weight="balanced", n_jobs=-1, random_state=42)


def best_threshold(y, p):
    if y.sum() == 0:
        raise ValueError("validation split has no attack rows")
    pr, rc, th = precision_recall_curve(y, p)
    f1 = 2 * pr[:-1] * rc[:-1] / np.maximum(pr[:-1] + rc[:-1], 1e-12)
    return float(th[int(np.argmax(f1))])


def _thin(a, b, n=200):
    idx = np.unique(np.linspace(0, len(a) - 1, min(n, len(a))).astype(int))
    return [round(float(a[i]), 5) for i in idx], [round(float(b[i]), 5) for i in idx]


def metrics_block(y, p, thr, curves=False):
    pred = (p >= thr).astype(int)
    tn, fp, fn, tp = confusion_matrix(y, pred, labels=[0, 1]).ravel()
    prec = tp / (tp + fp) if tp + fp else 0.0
    rec = tp / (tp + fn) if tp + fn else 0.0
    out = {"threshold": float(thr), "accuracy": float((tp + tn) / len(y)), "precision": float(prec),
           "recall": float(rec), "f1": float(2 * prec * rec / (prec + rec)) if prec + rec else 0.0,
           "fpr": float(fp / (fp + tn)) if fp + tn else 0.0,
           "roc_auc": float(roc_auc_score(y, p)), "pr_auc": float(average_precision_score(y, p)),
           "confusion": {"tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp)}}
    if curves:
        fpr, tpr, _ = roc_curve(y, p)
        pr, rc, _ = precision_recall_curve(y, p)
        out["roc_curve"] = dict(zip(("fpr", "tpr"), _thin(fpr, tpr)))
        out["pr_curve"] = dict(zip(("recall", "precision"), _thin(rc, pr)))
    return out


def load_artifacts(d):
    d = Path(d)
    sc, ssm = joblib.load(d / "scaler.joblib"), joblib.load(d / "switching_ssm.joblib")
    return {"selector": joblib.load(d / "feature_selector.joblib"), "rf_scaler": sc["rf"], "sssm_scaler": sc["sssm"],
            "top_idx": ssm["top_idx"], "prior_attack": ssm["prior_attack"],
            "rf": joblib.load(d / "random_forest.joblib"),
            "threshold": json.loads((d / "threshold.json").read_text())["threshold"]}


def predict_segment(art, X):
    f = segment_features(X, art)
    return art["rf"].predict_proba(stack(f, VARIANTS["hybrid"]))[:, 1], f