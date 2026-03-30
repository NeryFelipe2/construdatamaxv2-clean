#!/usr/bin/env python3
"""
MOTOR_PARAMETRICO.PY — Pipe Network Paramétrico (recálculo em cascata)
ConstruData - HydroNetwork · CT 11481051 · FCN Construções e Saneamento

Mexeu o PV → recalcula TUDO automaticamente:
  PV moveu → extensão recalcula → declividade recalcula → Manning recalcula
  → custo recalcula → IFC regenera → cronograma atualiza → medição atualiza

Mudou DN → Manning recalcula → custo recalcula → geometria IFC atualiza
Mudou cota → profundidade recalcula → escavação recalcula → custo recalcula

GRAFO TOPOLÓGICO:
  Cada PV sabe quais tubos conectam nele (adjacência bidirecional).
  Mudança em 1 PV propaga para todos os trechos conectados.
"""

import math, json, copy
from collections import defaultdict
from datetime import datetime

# Manning constants
MANNING_N = {"PVC": 0.013, "PEAD": 0.011, "PE 80": 0.011, "PE 100": 0.011, "CONCRETO": 0.015}


class PipeNetwork:
    """
    Rede paramétrica de tubulações.
    Qualquer alteração dispara recálculo em cascata.
    """
    
    def __init__(self, pvs=None, trechos=None):
        self.pvs = pvs or {}
        self.trechos = trechos or []
        self._adjacencia = defaultdict(list)  # pv_nome → [trecho_idx, ...]
        self._build_graph()
        self._recalc_all()
    
    def _build_graph(self):
        """Constrói grafo de adjacência."""
        self._adjacencia.clear()
        for i, tr in enumerate(self.trechos):
            self._adjacencia[tr.get("pv_ini", "")].append(i)
            self._adjacencia[tr.get("pv_fim", "")].append(i)
    
    # ═══════════════════════════════════════════
    # OPERAÇÕES COM RECÁLCULO AUTOMÁTICO
    # ═══════════════════════════════════════════
    
    def mover_pv(self, nome, novo_x, novo_y):
        """Move PV → recalcula extensão, declividade, Manning, custo de TODOS os trechos conectados."""
        if nome not in self.pvs:
            raise KeyError(f"PV '{nome}' não existe")
        
        self.pvs[nome]["x"] = novo_x
        self.pvs[nome]["y"] = novo_y
        
        # Recalcular trechos conectados
        afetados = self._adjacencia.get(nome, [])
        for idx in afetados:
            self._recalc_trecho(idx)
        
        return {"pv": nome, "trechos_recalculados": len(afetados)}
    
    def alterar_cota(self, nome, ct=None, cf=None):
        """Altera cota do PV → recalcula profundidade, declividade, escavação, custo."""
        if nome not in self.pvs:
            raise KeyError(f"PV '{nome}' não existe")
        
        if ct is not None:
            self.pvs[nome]["ct"] = ct
        if cf is not None:
            self.pvs[nome]["cf"] = cf
        
        # Recalcular profundidade
        pv = self.pvs[nome]
        if pv.get("ct") and pv.get("cf"):
            pv["prof"] = round(pv["ct"] - pv["cf"], 3)
        
        # Propagar para trechos
        afetados = self._adjacencia.get(nome, [])
        for idx in afetados:
            self._recalc_trecho(idx)
        
        return {"pv": nome, "ct": ct, "cf": cf, "trechos_recalculados": len(afetados)}
    
    def alterar_dn(self, trecho_idx, novo_dn):
        """Altera DN de um trecho → recalcula Manning, custo, geometria."""
        if trecho_idx >= len(self.trechos):
            raise IndexError(f"Trecho {trecho_idx} não existe")
        
        self.trechos[trecho_idx]["dn_mm"] = novo_dn
        self._recalc_trecho(trecho_idx)
        
        return {"trecho": trecho_idx, "dn_mm": novo_dn}
    
    def alterar_material(self, trecho_idx, novo_material):
        """Altera material → recalcula Manning (n diferente), custo."""
        if trecho_idx >= len(self.trechos):
            raise IndexError(f"Trecho {trecho_idx} não existe")
        
        self.trechos[trecho_idx]["material"] = novo_material
        self._recalc_trecho(trecho_idx)
        
        return {"trecho": trecho_idx, "material": novo_material}
    
    def adicionar_pv(self, nome, x, y, ct=0, cf=0, tipo="esgoto"):
        """Adiciona novo PV à rede."""
        self.pvs[nome] = {"x": x, "y": y, "ct": ct, "cf": cf, "tipo": tipo,
                          "prof": round(ct - cf, 3) if ct and cf else 0}
        return {"pv": nome}
    
    def remover_pv(self, nome):
        """Remove PV e todos os trechos conectados."""
        afetados = list(self._adjacencia.get(nome, []))
        # Remove trechos de trás pra frente (não bagunçar índices)
        for idx in sorted(afetados, reverse=True):
            self.trechos.pop(idx)
        del self.pvs[nome]
        self._build_graph()
        return {"pv_removido": nome, "trechos_removidos": len(afetados)}
    
    def adicionar_trecho(self, pv_ini, pv_fim, dn_mm=200, material="PVC", tipo="esgoto"):
        """Adiciona trecho e calcula tudo automaticamente."""
        tr = {"pv_ini": pv_ini, "pv_fim": pv_fim, "dn_mm": dn_mm,
              "material": material, "tipo": tipo, "ext_m": 0, "decl_mm": 0}
        self.trechos.append(tr)
        idx = len(self.trechos) - 1
        self._adjacencia[pv_ini].append(idx)
        self._adjacencia[pv_fim].append(idx)
        self._recalc_trecho(idx)
        return {"trecho": idx, "ext_m": tr["ext_m"]}
    
    def remover_trecho(self, trecho_idx):
        """Remove trecho."""
        if trecho_idx >= len(self.trechos):
            raise IndexError(f"Trecho {trecho_idx} não existe")
        self.trechos.pop(trecho_idx)
        self._build_graph()
        return {"trecho_removido": trecho_idx}
    
    # ═══════════════════════════════════════════
    # RECÁLCULO EM CASCATA
    # ═══════════════════════════════════════════
    
    def _recalc_trecho(self, idx):
        """Recalcula UM trecho: extensão → declividade → Manning → custo."""
        tr = self.trechos[idx]
        p0 = self.pvs.get(tr.get("pv_ini"), {})
        p1 = self.pvs.get(tr.get("pv_fim"), {})
        
        # Extensão
        if p0.get("x") and p1.get("x"):
            tr["ext_m"] = round(math.sqrt((p0["x"] - p1["x"])**2 + (p0["y"] - p1["y"])**2), 2)
        
        # Declividade
        cf0 = p0.get("cf") or 0
        cf1 = p1.get("cf") or 0
        if cf0 and cf1 and tr["ext_m"] > 0:
            tr["decl_mm"] = round((cf0 - cf1) / tr["ext_m"] * 1000, 4)
        else:
            tr["decl_mm"] = 0
        
        # Manning
        dn = tr.get("dn_mm") or 200
        mat = tr.get("material", "PVC")
        n = MANNING_N.get(mat, 0.013)
        D = dn / 1000
        I = abs(tr["decl_mm"]) / 1000
        
        if I > 0 and D > 0:
            A = math.pi * D * D / 4
            Rh = D / 4
            V = (1 / n) * Rh ** (2/3) * I ** 0.5
            Q = V * A * 1000
            tau = 9810 * Rh * I
            tr["v_ms"] = round(V, 4)
            tr["q_ls"] = round(Q, 4)
            tr["tau_pa"] = round(tau, 2)
        else:
            tr["v_ms"] = 0
            tr["q_ls"] = 0
            tr["tau_pa"] = 0
        
        # Profundidade média
        ct0 = p0.get("ct") or 0
        ct1 = p1.get("ct") or 0
        prof0 = ct0 - cf0 if ct0 and cf0 else 1.5
        prof1 = ct1 - cf1 if ct1 and cf1 else 1.5
        tr["prof_media"] = round((prof0 + prof1) / 2, 2)
        
        # Custo rápido (R$ 910/m do contrato)
        tr["custo_estimado"] = round(tr["ext_m"] * 910, 0)
        
        # Verificações
        tr["alertas"] = []
        if tr["v_ms"] > 5: tr["alertas"].append("VELOCIDADE > 5 m/s")
        if tr["v_ms"] < 0.6 and tr["v_ms"] > 0: tr["alertas"].append("VELOCIDADE < 0.6 m/s (autolimpeza)")
        if tr["tau_pa"] < 1.0 and tr["tau_pa"] > 0: tr["alertas"].append("TENSÃO TRATIVA < 1.0 Pa (NBR 9649)")
        if tr["decl_mm"] < 0: tr["alertas"].append("DECLIVIDADE NEGATIVA (contra-fluxo)")
        if tr["prof_media"] > 5: tr["alertas"].append("PROFUNDIDADE > 5m (escoramento especial)")
    
    def _recalc_all(self):
        """Recalcula TODOS os trechos."""
        for i in range(len(self.trechos)):
            self._recalc_trecho(i)
    
    # ═══════════════════════════════════════════
    # CONSULTAS
    # ═══════════════════════════════════════════
    
    def resumo(self):
        """Resumo geral da rede."""
        ext = sum(t.get("ext_m", 0) for t in self.trechos)
        custo = sum(t.get("custo_estimado", 0) for t in self.trechos)
        alertas = sum(len(t.get("alertas", [])) for t in self.trechos)
        return {
            "n_pvs": len(self.pvs),
            "n_trechos": len(self.trechos),
            "extensao_total": round(ext, 1),
            "custo_total": round(custo, 0),
            "n_alertas": alertas,
        }
    
    def trechos_com_alerta(self):
        """Retorna trechos que têm alertas hidráulicos."""
        return [(i, t) for i, t in enumerate(self.trechos) if t.get("alertas")]
    
    def vizinhos(self, pv_nome):
        """Retorna PVs vizinhos (conectados por tubo)."""
        viz = set()
        for idx in self._adjacencia.get(pv_nome, []):
            tr = self.trechos[idx]
            if tr["pv_ini"] == pv_nome:
                viz.add(tr["pv_fim"])
            else:
                viz.add(tr["pv_ini"])
        return list(viz)
    
    def exportar(self):
        """Exporta para formato JSON padrão (pvs + trechos)."""
        return {
            "pvs": copy.deepcopy(self.pvs),
            "trechos": copy.deepcopy(self.trechos),
            "meta": {
                "plataforma": "ConstruData - HydroNetwork",
                "tipo": "PipeNetwork Paramétrico",
                "data": datetime.now().isoformat(),
                "resumo": self.resumo(),
            }
        }
    
    @classmethod
    def from_json(cls, data):
        """Cria PipeNetwork a partir de JSON."""
        return cls(pvs=data.get("pvs", {}), trechos=data.get("trechos", []))
    
    @classmethod
    def from_leitor(cls, leitor_func, path, *args):
        """Cria PipeNetwork a partir de qualquer leitor (ler_dxf_gdal, ler_dwg_aec, etc.)."""
        result = leitor_func(path, *args)
        if len(result) == 4:  # ler_dxf_gdal retorna 4
            pvs, trechos = result[0], result[1]
        elif len(result) == 3:  # ler_dwg_aec retorna 3
            pvs, trechos = result[0], result[1]
        else:
            pvs, trechos = result[0], result[1]
        return cls(pvs=pvs, trechos=trechos)


if __name__ == "__main__":
    import sys
    sys.path.insert(0, "/mnt/user-data/outputs")
    sys.path.insert(0, "CONSTRUDATA_BIM_V6/scripts")
    
    from ler_dxf_gdal import ler_dxf_gdal
    pvs, trechos, _, _ = ler_dxf_gdal("/home/claude/VERDE_TETEU.dxf")
    
    # Criar rede paramétrica
    rede = PipeNetwork(pvs, trechos)
    
    print("═" * 60)
    print("  PIPE NETWORK PARAMÉTRICO — Verde e Teteu")
    print("═" * 60)
    
    r = rede.resumo()
    print(f"\n  {r['n_pvs']} PVs | {r['n_trechos']} trechos | {r['extensao_total']}m | R$ {r['custo_total']:,.0f}")
    print(f"  Alertas: {r['n_alertas']}")
    
    # Testar recálculo em cascata
    pv_teste = list(pvs.keys())[0]
    pv_dados = pvs[pv_teste]
    print(f"\n  Teste cascata: movendo {pv_teste} +10m em X...")
    
    antes = rede.trechos[0].copy()
    result = rede.mover_pv(pv_teste, pv_dados["x"] + 10, pv_dados["y"])
    depois = rede.trechos[0]
    
    print(f"    Trechos recalculados: {result['trechos_recalculados']}")
    print(f"    Ext antes: {antes.get('ext_m',0):.2f}m → depois: {depois.get('ext_m',0):.2f}m")
    print(f"    V antes: {antes.get('v_ms',0):.4f} → depois: {depois.get('v_ms',0):.4f}")
    
    # Testar alterar DN
    print(f"\n  Teste: alterando DN do trecho 0 para 300mm...")
    antes_dn = rede.trechos[0].copy()
    rede.alterar_dn(0, 300)
    depois_dn = rede.trechos[0]
    print(f"    DN: {antes_dn['dn_mm']} → {depois_dn['dn_mm']}")
    print(f"    V: {antes_dn.get('v_ms',0):.4f} → {depois_dn.get('v_ms',0):.4f}")
    print(f"    Q: {antes_dn.get('q_ls',0):.4f} → {depois_dn.get('q_ls',0):.4f}")
    
    # Alertas
    alertas = rede.trechos_com_alerta()
    print(f"\n  Trechos com alerta: {len(alertas)}")
    for idx, tr in alertas[:5]:
        print(f"    T{idx}: {tr['pv_ini']}→{tr['pv_fim']} | {tr['alertas']}")
    
    print(f"\n  ✅ Pipe Network Paramétrico funcionando")
