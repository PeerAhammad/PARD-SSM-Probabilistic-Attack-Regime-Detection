"""Order-preserving loaders for CICIDS2017 and UNSW-NB15."""
from pathlib import Path
import numpy as np
import pandas as pd
from src.data_processing.dataset_loader import CICIDS_FEATURE_COLS

DAY_ORDER = ["monday", "tuesday", "wednesday", "thursday-workinghours-morning",
             "thursday-workinghours-afternoon", "friday-workinghours-morning",
             "friday-workinghours-afternoon-portscan", "friday-workinghours-afternoon-ddos"]

# Column order of the raw UNSW-NB15_1..4.csv files (official feature list; these files have no header row)
UNSW_COLS = ["srcip", "sport", "dstip", "dsport", "proto", "state", "dur", "sbytes", "dbytes", "sttl", "dttl",
             "sloss", "dloss", "service", "Sload", "Dload", "Spkts", "Dpkts", "swin", "dwin", "stcpb", "dtcpb",
             "smeansz", "dmeansz", "trans_depth", "res_bdy_len", "Sjit", "Djit", "Stime", "Ltime", "Sintpkt",
             "Dintpkt", "tcprtt", "synack", "ackdat", "is_sm_ips_ports", "ct_state_ttl", "ct_flw_http_mthd",
             "is_ftp_login", "ct_ftp_cmd", "ct_srv_src", "ct_srv_dst", "ct_dst_ltm", "ct_src_ltm",
             "ct_src_dport_ltm", "ct_dst_sport_ltm", "ct_dst_src_ltm", "attack_cat", "Label"]
UNSW_FEATURES = ["dur", "sbytes", "dbytes", "sttl", "dttl", "sloss", "dloss", "Sload", "Dload", "Spkts", "Dpkts",
                 "swin", "dwin", "stcpb", "dtcpb", "smeansz", "dmeansz", "trans_depth", "res_bdy_len", "Sjit",
                 "Djit", "Sintpkt", "Dintpkt", "tcprtt", "synack", "ackdat", "is_sm_ips_ports", "ct_state_ttl",
                 "ct_flw_http_mthd", "is_ftp_login", "ct_ftp_cmd", "ct_srv_src", "ct_srv_dst", "ct_dst_ltm",
                 "ct_src_ltm", "ct_src_dport_ltm", "ct_dst_sport_ltm", "ct_dst_src_ltm"]


def _day_rank(path):
    name = path.name.lower()
    for i, key in enumerate(DAY_ORDER):
        if name.startswith(key):
            return i
    return None


def _clean_label(s):
    # any non-ASCII run (the corrupted en dash in Web Attack labels) -> "-"
    return s.astype(str).str.strip().str.replace(r"[^\x20-\x7E]+", "-", regex=True)


def load_cicids_groups(raw, stride):
    files = sorted(((r, f) for f in Path(raw).rglob("*.csv") if (r := _day_rank(f)) is not None))
    if len(files) != 8:
        print(f"WARNING: expected 8 CICIDS daily files, found {len(files)}")
    feats = [c.strip() for c in CICIDS_FEATURE_COLS]
    groups = []
    for _, f in files:
        df = pd.read_csv(f, low_memory=False, encoding="latin-1")
        df.columns = df.columns.str.strip()
        missing = [c for c in feats if c not in df.columns]
        if missing:
            raise KeyError(f"{f.name}: missing columns {missing[:5]}")
        d = df[feats].apply(pd.to_numeric, errors="coerce")
        d["label"] = _clean_label(df["Label"])
        d = d.replace([np.inf, -np.inf], np.nan).dropna().drop_duplicates().iloc[::stride]
        y = (d["label"] != "BENIGN").astype(int).to_numpy()
        print(f"  {f.name}: {len(d):,} rows kept, {y.sum():,} attack")
        groups.append((f.name, d[feats].to_numpy(np.float64), y, d["label"].to_numpy()))
    return groups, feats


def load_unsw_groups(raw, stride):
    files = sorted(Path(raw).rglob("UNSW-NB15_[1-4].csv"))
    if not files:
        raise FileNotFoundError(f"UNSW-NB15_[1-4].csv not found under {raw}")
    parts = []
    for f in files:
        df = pd.read_csv(f, header=None, names=UNSW_COLS, low_memory=False, encoding="latin-1")
        parts.append(df[UNSW_FEATURES + ["Stime", "attack_cat", "Label"]])
        print(f"  {f.name}: {len(df):,} rows")
    df = pd.concat(parts, ignore_index=True)
    num = UNSW_FEATURES + ["Stime", "Label"]
    df[num] = df[num].apply(pd.to_numeric, errors="coerce")
    for c in ("ct_flw_http_mthd", "is_ftp_login", "ct_ftp_cmd"):   # blank = feature not applicable
        df[c] = df[c].fillna(0)
    df = df.replace([np.inf, -np.inf], np.nan).dropna(subset=num)
    if len(df) < 1000 or not set(df["Label"].unique()) <= {0, 1}:
        raise ValueError("UNSW column order mismatch: check against NUSW-NB15_features.csv")
    df["attack_cat"] = df["attack_cat"].fillna("Normal").astype(str).str.strip().replace({"Backdoor": "Backdoors", "": "Normal"})
    df = df.sort_values("Stime", kind="stable").drop_duplicates(subset=UNSW_FEATURES + ["Label"]).iloc[::stride]
    y = df["Label"].astype(int).to_numpy()
    lab = np.where(y == 0, "Normal", df["attack_cat"].to_numpy())
    print(f"  kept {len(df):,} rows sorted by Stime, {y.sum():,} attack")
    return [("UNSW-NB15 (sorted by Stime)", df[UNSW_FEATURES].to_numpy(np.float64), y, lab)], UNSW_FEATURES


def load_groups(dataset, raw, stride):
    return (load_cicids_groups if dataset == "cicids2017" else load_unsw_groups)(raw, stride)


def split_segments(groups, fr=(0.6, 0.2), gap=20):
    """Chronological 60/20/20 inside every capture group, with a `gap`-row embargo between splits."""
    out = {"train": [], "val": [], "test": []}
    for name, X, y, lab in groups:
        n = len(X)
        a, b = int(fr[0] * n), int((fr[0] + fr[1]) * n)
        for key, sl in (("train", slice(0, a)), ("val", slice(a + gap, b)), ("test", slice(b + gap, n))):
            if len(X[sl]) > 0:
                out[key].append((f"{name}:{key}", X[sl], y[sl], lab[sl]))
    return out