#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""GUI independente para gerar Nota de Servico v5."""
from __future__ import annotations

import json
import math
import threading
import traceback
from datetime import datetime
from pathlib import Path
from tkinter import BOTH, END, LEFT, RIGHT, X, Y, BooleanVar, Listbox, StringVar, Tk, filedialog, messagebox, ttk

from gerar_ns import enriquecer_trechos, gerar_geojson, gerar_html, gerar_ns_a4, gerar_ns_desenho, gerar_ns_sat


APP_TITLE = "NS v5 - Nota de Servico"


def _float(value: str, default: float = 0.0) -> float:
    try:
        text = str(value or "").strip().replace(",", ".")
        return float(text) if text else default
    except Exception:
        return default


def _int(value: str, default: int = 0) -> int:
    try:
        return int(float(str(value or "").replace(",", ".")))
    except Exception:
        return default


def _clean(value: str) -> str:
    return "".join(c if c.isalnum() or c in "_-" else "_" for c in str(value or "")).strip("_")


def _normalize_pvs(raw) -> dict:
    if isinstance(raw, dict):
        return {str(k): dict(v, id=str(k)) if isinstance(v, dict) else {"id": str(k)} for k, v in raw.items()}
    out = {}
    for item in raw or []:
        if not isinstance(item, dict):
            continue
        name = str(item.get("id") or item.get("nome") or item.get("pv") or item.get("name") or "")
        if name:
            out[name] = item
    return out


def _load_json(path: Path) -> tuple[dict, list, str]:
    data = json.loads(path.read_text(encoding="utf-8"))
    nucleo = data.get("nucleo") or data.get("obra") or path.stem
    if "pvs" in data and "trechos" in data:
        return _normalize_pvs(data["pvs"]), list(data["trechos"] or []), str(nucleo)
    if "trecho" in data and "pv_montante" in data and "pv_jusante" in data:
        trecho = dict(data["trecho"])
        pvi, pvf = trecho.get("pv_ini"), trecho.get("pv_fim")
        return _normalize_pvs({pvi: data["pv_montante"], pvf: data["pv_jusante"]}), [trecho], str(nucleo)
    if isinstance(data, list):
        trechos = [x for x in data if isinstance(x, dict) and x.get("pv_ini") and x.get("pv_fim")]
        return {}, trechos, str(nucleo)
    raise ValueError("JSON precisa conter pvs+trechos ou trecho+pv_montante+pv_jusante.")


def _load_dxf(path: Path) -> tuple[dict, list, str]:
    from ler_dxf_gdal import ler_dxf_gdal

    pvs, trechos, _ruas, meta = ler_dxf_gdal(str(path))
    nucleo = (meta or {}).get("nucleo") or path.stem
    return pvs, trechos, nucleo


class NSV5Gui:
    def __init__(self):
        self.root = Tk()
        self.root.title(APP_TITLE)
        self.root.geometry("1180x720")
        self.pvs: dict = {}
        self.trechos: list[dict] = []
        self.current_index = -1
        self.out_dir = StringVar(value=str(Path.cwd() / "SAIDA_NS_V5_GUI"))
        self.nucleo = StringVar(value="OBRA")
        self.status = StringVar(value="Pronto.")
        self.gerar_a4 = BooleanVar(value=True)
        self.gerar_desenho = BooleanVar(value=True)
        self.gerar_cartografia = BooleanVar(value=True)
        self.gerar_mapa = BooleanVar(value=True)
        self._fields: dict[str, StringVar] = {}
        self._build()

    def _build(self):
        top = ttk.Frame(self.root, padding=8)
        top.pack(fill=X)
        ttk.Label(top, text=APP_TITLE, font=("Segoe UI", 14, "bold")).pack(side=LEFT)
        ttk.Button(top, text="Carregar JSON/DXF", command=self.load_file).pack(side=RIGHT, padx=4)
        ttk.Button(top, text="Pasta Saida", command=self.pick_out).pack(side=RIGHT, padx=4)

        body = ttk.PanedWindow(self.root, orient="horizontal")
        body.pack(fill=BOTH, expand=True, padx=8, pady=4)

        left = ttk.Frame(body, padding=6)
        body.add(left, weight=1)
        ttk.Label(left, text="Trechos").pack(anchor="w")
        self.listbox = Listbox(left, height=28)
        self.listbox.pack(fill=BOTH, expand=True)
        self.listbox.bind("<<ListboxSelect>>", self.on_select)
        ttk.Button(left, text="Novo manual", command=self.new_manual).pack(fill=X, pady=3)
        ttk.Button(left, text="Remover item", command=self.remove_selected).pack(fill=X, pady=3)

        right = ttk.Frame(body, padding=6)
        body.add(right, weight=3)
        cfg = ttk.LabelFrame(right, text="Projeto", padding=8)
        cfg.pack(fill=X)
        self._entry(cfg, "Nucleo/Obra", self.nucleo, 0, 0)
        self._entry(cfg, "Pasta saida", self.out_dir, 0, 2, width=64)

        form = ttk.LabelFrame(right, text="Dados da NS", padding=8)
        form.pack(fill=X, pady=8)
        labels = [
            ("ns_id", "NS", "1"), ("pv_ini", "PV inicial", "PV_01"), ("pv_fim", "PV final", "PV_02"),
            ("x_ini", "E ini", ""), ("y_ini", "N ini", ""), ("ct_ini", "CT ini", ""), ("cf_ini", "CF ini", ""),
            ("x_fim", "E fim", ""), ("y_fim", "N fim", ""), ("ct_fim", "CT fim", ""), ("cf_fim", "CF fim", ""),
            ("dn_mm", "DN mm", "150"), ("ext_m", "Ext m", ""), ("decl_mm", "Decl m/m", "0.005"),
            ("material", "Material", "PVC"), ("rua", "Rua", ""),
        ]
        for i, (key, label, default) in enumerate(labels):
            self._fields[key] = StringVar(value=default)
            self._entry(form, label, self._fields[key], i // 4, (i % 4) * 2)

        opts = ttk.LabelFrame(right, text="Gerar", padding=8)
        opts.pack(fill=X)
        for text, var in [("A4", self.gerar_a4), ("Desenho", self.gerar_desenho), ("Cartografia + perfil", self.gerar_cartografia), ("HTML mapa", self.gerar_mapa)]:
            ttk.Checkbutton(opts, text=text, variable=var).pack(side=LEFT, padx=8)
        ttk.Button(opts, text="Gerar selecionada", command=self.generate_selected).pack(side=RIGHT, padx=4)
        ttk.Button(opts, text="Gerar todas", command=self.generate_all).pack(side=RIGHT, padx=4)
        ttk.Button(opts, text="Salvar JSON base", command=self.save_base_json).pack(side=RIGHT, padx=4)

        log_box = ttk.LabelFrame(right, text="Log", padding=8)
        log_box.pack(fill=BOTH, expand=True, pady=8)
        self.log = Listbox(log_box)
        self.log.pack(fill=BOTH, expand=True)
        ttk.Label(self.root, textvariable=self.status, anchor="w").pack(fill=X, padx=8, pady=4)

    def _entry(self, parent, label: str, var: StringVar, row: int, col: int, width: int = 18):
        ttk.Label(parent, text=label).grid(row=row, column=col, sticky="w", padx=4, pady=3)
        ttk.Entry(parent, textvariable=var, width=width).grid(row=row, column=col + 1, sticky="we", padx=4, pady=3)

    def log_msg(self, text: str):
        self.log.insert(END, f"{datetime.now().strftime('%H:%M:%S')}  {text}")
        self.log.see(END)
        self.status.set(text)
        self.root.update_idletasks()

    def refresh_list(self):
        self.listbox.delete(0, END)
        for i, t in enumerate(self.trechos, 1):
            self.listbox.insert(END, f"NS{i:03d}  {t.get('pv_ini')} -> {t.get('pv_fim')}  DN{t.get('dn_mm', '')}  {t.get('ext_m', '')}m")

    def load_file(self):
        path = filedialog.askopenfilename(filetypes=[("JSON/DXF", "*.json *.dxf"), ("Todos", "*.*")])
        if not path:
            return
        path = Path(path)

        def run():
            try:
                self.log_msg(f"Carregando {path.name}...")
                pvs, trechos, nucleo = _load_dxf(path) if path.suffix.lower() == ".dxf" else _load_json(path)
                self.pvs = pvs
                self.trechos = enriquecer_trechos(trechos, self.pvs)
                self.nucleo.set(nucleo)
                self.refresh_list()
                if self.trechos:
                    self.listbox.selection_set(0)
                    self.on_select()
                self.log_msg(f"Carregado: {len(self.pvs)} PVs, {len(self.trechos)} trechos.")
            except Exception as exc:
                messagebox.showerror(APP_TITLE, f"Falha ao carregar:\n{exc}")
                self.log_msg(traceback.format_exc().splitlines()[-1])

        threading.Thread(target=run, daemon=True).start()

    def pick_out(self):
        path = filedialog.askdirectory()
        if path:
            self.out_dir.set(path)

    def on_select(self, *_):
        sel = self.listbox.curselection()
        if not sel:
            return
        self.current_index = int(sel[0])
        self.fill_form(self.current_index, self.trechos[self.current_index])

    def fill_form(self, idx: int, trecho: dict):
        p0 = self.pvs.get(trecho.get("pv_ini"), {})
        p1 = self.pvs.get(trecho.get("pv_fim"), {})
        values = {
            "ns_id": idx + 1, "pv_ini": trecho.get("pv_ini", ""), "pv_fim": trecho.get("pv_fim", ""),
            "x_ini": p0.get("x", ""), "y_ini": p0.get("y", ""), "ct_ini": p0.get("ct", ""), "cf_ini": p0.get("cf", ""),
            "x_fim": p1.get("x", ""), "y_fim": p1.get("y", ""), "ct_fim": p1.get("ct", ""), "cf_fim": p1.get("cf", ""),
            "dn_mm": trecho.get("dn_mm", 150), "ext_m": trecho.get("ext_m", ""), "decl_mm": trecho.get("decl_mm", 0.005),
            "material": trecho.get("material", "PVC"), "rua": trecho.get("rua", ""),
        }
        for k, v in values.items():
            self._fields[k].set("" if v is None else str(v))

    def form_to_data(self) -> tuple[int, dict, dict]:
        f = {k: v.get().strip() for k, v in self._fields.items()}
        pvi, pvf = f["pv_ini"] or "PV_01", f["pv_fim"] or "PV_02"
        pvs = {
            pvi: {"id": pvi, "x": _float(f["x_ini"]), "y": _float(f["y_ini"]), "ct": _float(f["ct_ini"]), "cf": _float(f["cf_ini"])},
            pvf: {"id": pvf, "x": _float(f["x_fim"]), "y": _float(f["y_fim"]), "ct": _float(f["ct_fim"]), "cf": _float(f["cf_fim"])},
        }
        for pv in pvs.values():
            pv["prof"] = abs((pv.get("ct") or 0) - (pv.get("cf") or 0))
        ext = _float(f["ext_m"])
        if not ext and pvs[pvi]["x"] and pvs[pvf]["x"]:
            ext = round(math.hypot(pvs[pvf]["x"] - pvs[pvi]["x"], pvs[pvf]["y"] - pvs[pvi]["y"]), 2)
        trecho = {
            "pv_ini": pvi, "pv_fim": pvf, "dn_mm": _int(f["dn_mm"], 150),
            "ext_m": ext, "decl_mm": _float(f["decl_mm"], 0.005),
            "material": f["material"] or "PVC", "rua": f["rua"] or "Sem Rua", "tipo": "esgoto",
        }
        return _int(f["ns_id"], 1), trecho, pvs

    def new_manual(self):
        self.trechos.append({"pv_ini": "PV_01", "pv_fim": "PV_02", "dn_mm": 150, "ext_m": 0, "decl_mm": 0.005, "material": "PVC", "rua": ""})
        self.pvs.setdefault("PV_01", {"x": 0, "y": 0, "ct": 0, "cf": 0})
        self.pvs.setdefault("PV_02", {"x": 0, "y": 0, "ct": 0, "cf": 0})
        self.refresh_list()
        self.listbox.selection_clear(0, END)
        self.listbox.selection_set(len(self.trechos) - 1)
        self.on_select()

    def remove_selected(self):
        sel = self.listbox.curselection()
        if not sel:
            return
        del self.trechos[int(sel[0])]
        self.refresh_list()

    def _generate_one(self, ns_id: int, trecho: dict, pvs: dict, all_trechos: list[dict], folder: Path):
        folder.mkdir(parents=True, exist_ok=True)
        base = f"NS{ns_id:03d}_{_clean(trecho['pv_ini'])}_AO_{_clean(trecho['pv_fim'])}"
        if self.gerar_a4.get():
            gerar_ns_a4(ns_id, trecho, pvs, self.nucleo.get(), folder / f"{base}_A4.pdf")
        if self.gerar_desenho.get():
            gerar_ns_desenho(ns_id, trecho, pvs, all_trechos, self.nucleo.get(), folder / f"{base}_DESENHO.pdf")
        if self.gerar_cartografia.get():
            gerar_ns_sat(ns_id, trecho, pvs, self.nucleo.get(), folder / f"{base}_CARTOGRAFIA.pdf")
        if self.gerar_mapa.get():
            gerar_html(ns_id, trecho, pvs, all_trechos, self.nucleo.get(), folder / f"{base}_MAPA.html")
        gerar_geojson([trecho], pvs, folder / f"{base}.geojson")
        (folder / f"{base}_DADOS.json").write_text(json.dumps({"nucleo": self.nucleo.get(), "trecho": trecho, "pvs": pvs}, indent=2, ensure_ascii=False, default=str), encoding="utf-8")

    def generate_selected(self):
        ns_id, trecho, pvs = self.form_to_data()
        out = Path(self.out_dir.get()) / f"NS{ns_id:03d}_{_clean(trecho['pv_ini'])}_AO_{_clean(trecho['pv_fim'])}"
        try:
            self._generate_one(ns_id, trecho, pvs, [trecho], out)
            self.log_msg(f"Gerada NS{ns_id:03d}: {out}")
        except Exception as exc:
            messagebox.showerror(APP_TITLE, str(exc))
            self.log_msg(traceback.format_exc().splitlines()[-1])

    def generate_all(self):
        if not self.trechos:
            self.generate_selected()
            return
        out_base = Path(self.out_dir.get())

        def run():
            try:
                all_t = enriquecer_trechos(self.trechos, self.pvs)
                for i, trecho in enumerate(all_t, 1):
                    folder = out_base / f"NS{i:03d}_{_clean(trecho['pv_ini'])}_AO_{_clean(trecho['pv_fim'])}"
                    self._generate_one(i, trecho, self.pvs, all_t, folder)
                    self.log_msg(f"OK NS{i:03d}")
                self.log_msg(f"Concluido: {len(all_t)} NS em {out_base}")
            except Exception as exc:
                messagebox.showerror(APP_TITLE, str(exc))
                self.log_msg(traceback.format_exc().splitlines()[-1])

        threading.Thread(target=run, daemon=True).start()

    def save_base_json(self):
        path = filedialog.asksaveasfilename(defaultextension=".json", filetypes=[("JSON", "*.json")])
        if not path:
            return
        ns_id, trecho, pvs = self.form_to_data()
        data = {"nucleo": self.nucleo.get(), "pvs": pvs if not self.pvs else self.pvs, "trechos": self.trechos or [trecho]}
        Path(path).write_text(json.dumps(data, indent=2, ensure_ascii=False, default=str), encoding="utf-8")
        self.log_msg(f"JSON salvo: {path}")

    def run(self):
        self.root.mainloop()


if __name__ == "__main__":
    NSV5Gui().run()
