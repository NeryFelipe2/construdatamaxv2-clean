#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ConstruData ML — Classificador de trechos (real vs falso)
Usa XGBoost + GridSearchCV para aprender com as decisoes do usuario.

Fluxo:
1. Usuario processa DXF e valida no mapa (marca real/falso)
2. Dados salvos como dataset de treino
3. XGBoost treina com os dados acumulados
4. Proximos DXFs: modelo prediz automaticamente
5. Usuario so confirma/corrige os duvidosos
"""

import json, math, pickle
from pathlib import Path
import numpy as np

try:
    from xgboost import XGBClassifier
    from sklearn.model_selection import GridSearchCV
    from sklearn.metrics import classification_report
    _HAS_ML = True
except ImportError:
    _HAS_ML = False

# Arquivo do modelo treinado
MODELO_PATH = Path(__file__).parent / "config" / "ml_modelo_trechos.pkl"
DATASET_PATH = Path(__file__).parent / "config" / "ml_dataset_trechos.json"


def extrair_features(trecho, pvs):
    """Extrai features geometricas de um trecho para classificacao."""
    pvi = pvs.get(trecho.get("pv_ini"), {})
    pvf = pvs.get(trecho.get("pv_fim"), {})

    xi, yi = pvi.get("x", 0), pvi.get("y", 0)
    xf, yf = pvf.get("x", 0), pvf.get("y", 0)
    ext = trecho.get("ext_m", 0) or 0
    dn = trecho.get("dn_mm") or 0

    dist_pvs = math.hypot(xf - xi, yf - yi) if xi and xf else 0
    ratio = dist_pvs / max(ext, 0.1) if ext > 0 else 0

    return {
        "ext_m": ext,
        "dn_mm": dn,
        "dist_pvs": round(dist_pvs, 2),
        "ratio_dist_ext": round(ratio, 3),
        "tem_ct_ini": 1 if pvi.get("ct") is not None else 0,
        "tem_ct_fim": 1 if pvf.get("ct") is not None else 0,
        "tem_cf_ini": 1 if pvi.get("cf") is not None else 0,
        "tem_cf_fim": 1 if pvf.get("cf") is not None else 0,
        "dn_padrao": 1 if dn in (100, 150, 200, 250, 300, 400) else 0,
        "pv_ini_sintetico": 1 if pvi.get("sintetico") else 0,
        "pv_fim_sintetico": 1 if pvf.get("sintetico") else 0,
        "cruza_quadra": 1 if trecho.get("_cruza_quadra") else 0,
    }


def salvar_decisoes(trechos, pvs, checkstates, nucleo=""):
    """Salva as decisoes do usuario (incluido/excluido) como dataset de treino."""
    DATASET_PATH.parent.mkdir(parents=True, exist_ok=True)

    # Carregar dataset existente
    dataset = []
    if DATASET_PATH.exists():
        with open(DATASET_PATH, "r", encoding="utf-8") as f:
            dataset = json.load(f)

    # Adicionar novas decisoes
    for i, t in enumerate(trechos):
        if i >= len(checkstates):
            break
        feat = extrair_features(t, pvs)
        feat["label"] = 1 if checkstates[i] else 0  # 1=real, 0=falso
        feat["nucleo"] = nucleo
        feat["pv_ini"] = t.get("pv_ini", "")
        feat["pv_fim"] = t.get("pv_fim", "")
        dataset.append(feat)

    with open(DATASET_PATH, "w", encoding="utf-8") as f:
        json.dump(dataset, f, indent=2, ensure_ascii=False)

    return len(dataset)


def treinar_modelo():
    """Treina XGBoost com GridSearchCV usando dataset acumulado."""
    if not _HAS_ML:
        raise ImportError("pip install xgboost scikit-learn")

    if not DATASET_PATH.exists():
        raise FileNotFoundError("Sem dataset. Valide trechos no mapa primeiro.")

    with open(DATASET_PATH, "r", encoding="utf-8") as f:
        dataset = json.load(f)

    if len(dataset) < 20:
        raise ValueError(f"Dataset muito pequeno ({len(dataset)} amostras). Minimo: 20.")

    # Features numericas
    feature_cols = ["ext_m", "dn_mm", "dist_pvs", "ratio_dist_ext",
                    "tem_ct_ini", "tem_ct_fim", "tem_cf_ini", "tem_cf_fim",
                    "dn_padrao", "pv_ini_sintetico", "pv_fim_sintetico", "cruza_quadra"]

    X = np.array([[d.get(c, 0) for c in feature_cols] for d in dataset])
    y = np.array([d["label"] for d in dataset])

    # GridSearchCV
    param_grid = {
        "max_depth": [3, 5, 7],
        "n_estimators": [50, 100],
        "learning_rate": [0.05, 0.1, 0.3],
    }
    grid = GridSearchCV(
        XGBClassifier(eval_metric="logloss", use_label_encoder=False),
        param_grid, cv=min(3, len(set(y))), scoring="f1", n_jobs=-1
    )
    grid.fit(X, y)

    # Salvar modelo
    MODELO_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(MODELO_PATH, "wb") as f:
        pickle.dump({"modelo": grid.best_estimator_,
                      "features": feature_cols,
                      "best_params": grid.best_params_,
                      "n_amostras": len(dataset)}, f)

    report = classification_report(y, grid.predict(X), output_dict=True)
    return {
        "best_params": grid.best_params_,
        "f1": round(report["weighted avg"]["f1-score"], 3),
        "accuracy": round(report["accuracy"], 3),
        "n_amostras": len(dataset),
        "n_reais": int(y.sum()),
        "n_falsos": int(len(y) - y.sum()),
    }


def predizer(trechos, pvs):
    """Prediz quais trechos sao reais usando modelo treinado."""
    if not _HAS_ML:
        return [True] * len(trechos)

    if not MODELO_PATH.exists():
        return [True] * len(trechos)  # sem modelo, incluir tudo

    with open(MODELO_PATH, "rb") as f:
        data = pickle.load(f)

    modelo = data["modelo"]
    feature_cols = data["features"]

    X = np.array([[extrair_features(t, pvs).get(c, 0) for c in feature_cols]
                  for t in trechos])
    preds = modelo.predict(X)
    return [bool(p) for p in preds]


def gerar_visualizacao(output_path="ml_analise.png"):
    """Gera graficos Seaborn da analise do dataset."""
    try:
        import seaborn as sns
        import matplotlib.pyplot as plt
        import pandas as pd
    except ImportError:
        raise ImportError("pip install seaborn matplotlib pandas")

    if not DATASET_PATH.exists():
        raise FileNotFoundError("Sem dataset.")

    with open(DATASET_PATH, "r", encoding="utf-8") as f:
        dataset = json.load(f)

    df = pd.DataFrame(dataset)
    df["status"] = df["label"].map({1: "Real", 0: "Falso"})

    fig, axes = plt.subplots(2, 2, figsize=(12, 10))
    fig.suptitle("ConstruData ML — Analise de Trechos", fontsize=14, fontweight="bold")

    # 1. Distribuicao de extensoes
    sns.boxplot(x="status", y="ext_m", data=df, ax=axes[0, 0], palette=["#ef4444", "#22c55e"])
    axes[0, 0].set_title("Extensao por Status")

    # 2. Distancia PV-PV
    sns.boxplot(x="status", y="dist_pvs", data=df, ax=axes[0, 1], palette=["#ef4444", "#22c55e"])
    axes[0, 1].set_title("Distancia PV-PV por Status")

    # 3. Ratio dist/ext
    sns.histplot(data=df, x="ratio_dist_ext", hue="status", bins=30, ax=axes[1, 0],
                 palette=["#ef4444", "#22c55e"])
    axes[1, 0].set_title("Ratio Distancia/Extensao")

    # 4. Heatmap correlacao
    feat_cols = ["ext_m", "dist_pvs", "ratio_dist_ext", "tem_ct_ini", "cruza_quadra", "label"]
    corr = df[feat_cols].corr()
    sns.heatmap(corr, annot=True, cmap="RdYlGn", center=0, ax=axes[1, 1], fmt=".2f")
    axes[1, 1].set_title("Correlacao Features")

    plt.tight_layout()
    plt.savefig(output_path, dpi=150, bbox_inches="tight")
    plt.close()
    return output_path
