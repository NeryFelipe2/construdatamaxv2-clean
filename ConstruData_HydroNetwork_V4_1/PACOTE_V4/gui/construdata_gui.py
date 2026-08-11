#!/usr/bin/env python3
"""
CONSTRUDATA_GUI.PY — GUI Desktop ConstruData HydroNetwork
FCN Construções e Saneamento · 12 abas · Multi-contrato

Dependências: pip install tkintermapview

12 ABAS:
  1. Processar    — Selecionar arquivo, rodar pipeline
  2. Mapa         — Leaflet, selecionar trechos, validar
  3. Rede         — Cards PVs/Trechos/Extensão + tabela
  4. Hidráulica   — Manning V/Q/τ por trecho
  5. Trechos      — Tabela completa
  6. Custos 5D    — Custo detalhado + BM + Curva S
  7. BIM/Civil3D  — Geradores + HTMLs
  8. Lean/LPS     — Takt, PPC, Lookahead, 6D
  9. Perdas       — UARL, ILI, DMAs, risco
  10. IA          — 4 LLMs (Gemini, Groq, Mistral, Cohere)
  11. Núcleos     — Batch DXF + prolongamentos
  12. Log         — Console com timestamps
"""

import tkinter as tk
from tkinter import ttk, filedialog, messagebox, scrolledtext
import json, os, sys, threading, subprocess, webbrowser
from pathlib import Path
from datetime import datetime

# Adicionar scripts ao path
SCRIPT_DIR = Path(__file__).parent / "scripts"
if SCRIPT_DIR.exists():
    sys.path.insert(0, str(SCRIPT_DIR))
else:
    sys.path.insert(0, str(Path(__file__).parent))

# ══════════════════════════════════════════════════════════
# ESTADO GLOBAL
# ══════════════════════════════════════════════════════════
class AppState:
    pvs = {}
    trechos = []
    ruas = []
    meta = {}
    arquivo = ""
    nucleo = ""
    saida = ""
    contrato_slug = ""

ST = AppState()

# ══════════════════════════════════════════════════════════
# CORES E ESTILO
# ══════════════════════════════════════════════════════════
BG = "#0a0a1a"
BG2 = "#12122a"
BG3 = "#1a1a3a"
FG = "#d0d0e8"
ACC = "#00ff88"
AGUA = "#00aaff"
RED = "#ff3355"
YEL = "#ffd000"
DIM = "#556688"
FONT = ("Segoe UI", 10)
FONT_MONO = ("Consolas", 10)
FONT_TITLE = ("Segoe UI", 12, "bold")
FONT_BIG = ("Consolas", 24, "bold")


class ConstruDataApp:
    def __init__(self, root):
        self.root = root
        self.root.title("ConstruData — HydroNetwork · FCN Construções e Saneamento")
        self.root.geometry("1280x800")
        self.root.configure(bg=BG)
        
        try:
            self.root.state('zoomed')
        except:
            pass
        
        # Estilo
        style = ttk.Style()
        style.theme_use('clam')
        style.configure("TNotebook", background=BG, borderwidth=0)
        style.configure("TNotebook.Tab", background=BG2, foreground=FG, padding=[12, 6],
                        font=("Segoe UI", 9, "bold"))
        style.map("TNotebook.Tab", background=[("selected", BG3)], foreground=[("selected", ACC)])
        style.configure("TFrame", background=BG)
        style.configure("TLabel", background=BG, foreground=FG, font=FONT)
        style.configure("TButton", background=BG2, foreground=FG, font=FONT, padding=[8, 4])
        style.configure("Green.TButton", background="#003322", foreground=ACC)
        style.configure("Blue.TButton", background="#002244", foreground=AGUA)
        style.configure("Red.TButton", background="#330022", foreground=RED)
        style.configure("Treeview", background=BG2, foreground=FG, fieldbackground=BG2,
                        font=FONT_MONO, rowheight=24)
        style.configure("Treeview.Heading", background=BG3, foreground=ACC, font=("Segoe UI", 9, "bold"))
        
        # Topbar
        topbar = tk.Frame(root, bg=BG2, height=40)
        topbar.pack(fill=tk.X)
        topbar.pack_propagate(False)
        tk.Label(topbar, text="ConstruData", bg=BG2, fg=ACC, font=("Segoe UI", 14, "bold")).pack(side=tk.LEFT, padx=10)
        tk.Label(topbar, text="HydroNetwork", bg=BG2, fg=DIM, font=("Segoe UI", 10)).pack(side=tk.LEFT)
        self.lbl_contrato = tk.Label(topbar, text="Nenhum contrato", bg=BG2, fg=YEL, font=FONT_MONO)
        self.lbl_contrato.pack(side=tk.RIGHT, padx=10)
        self.lbl_stats = tk.Label(topbar, text="PVs: 0 · Trechos: 0 · Ext: 0m", bg=BG2, fg=DIM, font=FONT_MONO)
        self.lbl_stats.pack(side=tk.RIGHT, padx=10)
        
        # Notebook (12 abas)
        self.nb = ttk.Notebook(root)
        self.nb.pack(fill=tk.BOTH, expand=True, padx=4, pady=4)
        
        self._build_tab_processar()
        self._build_tab_mapa()
        self._build_tab_rede()
        self._build_tab_hidraulica()
        self._build_tab_trechos()
        self._build_tab_custos()
        self._build_tab_bim()
        self._build_tab_lean()
        self._build_tab_perdas()
        self._build_tab_ia()
        self._build_tab_nucleos()
        self._build_tab_log()
        
        self.log("ConstruData HydroNetwork iniciado")
        self._check_contrato()
    
    # ══════════════════════════════════════════════════════
    # HELPERS
    # ══════════════════════════════════════════════════════
    def log(self, msg, level="INFO"):
        ts = datetime.now().strftime("%H:%M:%S")
        text = f"[{ts}] [{level}] {msg}\n"
        if hasattr(self, 'log_text'):
            self.log_text.insert(tk.END, text)
            self.log_text.see(tk.END)
        print(text, end="")
    
    def _update_stats(self):
        n = len(ST.pvs)
        t = len(ST.trechos)
        ext = round(sum(tr.get("ext_m", 0) for tr in ST.trechos), 0)
        self.lbl_stats.config(text=f"PVs: {n} · Trechos: {t} · Ext: {ext}m")
    
    def _check_contrato(self):
        try:
            from motor_contratos import get_contrato_ativo_slug, get_contrato
            slug = get_contrato_ativo_slug()
            if slug:
                c = get_contrato(slug)
                self.lbl_contrato.config(text=f"📋 {c['nome']} ({c['cidade']}/{c['estado']})")
                ST.contrato_slug = slug
            else:
                self.lbl_contrato.config(text="Nenhum contrato — clique pra criar")
        except:
            self.lbl_contrato.config(text="motor_contratos não disponível")
    
    def _make_card(self, parent, label, value, color=ACC, row=0, col=0):
        f = tk.Frame(parent, bg=BG2, bd=1, relief=tk.RIDGE, padx=12, pady=8)
        f.grid(row=row, column=col, padx=4, pady=4, sticky="nsew")
        tk.Label(f, text=label, bg=BG2, fg=DIM, font=("Segoe UI", 8)).pack()
        lbl = tk.Label(f, text=str(value), bg=BG2, fg=color, font=FONT_BIG)
        lbl.pack()
        return lbl
    
    def _run_async(self, func, *args):
        def wrapper():
            try:
                func(*args)
            except Exception as e:
                self.log(f"ERRO: {e}", "ERROR")
                messagebox.showerror("Erro", str(e))
        threading.Thread(target=wrapper, daemon=True).start()
    
    # ══════════════════════════════════════════════════════
    # TAB 1: PROCESSAR
    # ══════════════════════════════════════════════════════
    def _build_tab_processar(self):
        tab = tk.Frame(self.nb, bg=BG)
        self.nb.add(tab, text="📁 Processar")
        
        # Arquivo
        f1 = tk.LabelFrame(tab, text="Arquivo de Entrada", bg=BG, fg=ACC, font=FONT_TITLE, padx=10, pady=10)
        f1.pack(fill=tk.X, padx=10, pady=5)
        
        self.var_arquivo = tk.StringVar()
        tk.Entry(f1, textvariable=self.var_arquivo, font=FONT_MONO, bg=BG2, fg=FG, insertbackground=FG, width=80).pack(side=tk.LEFT, fill=tk.X, expand=True)
        ttk.Button(f1, text="📂 Selecionar", command=self._selecionar_arquivo).pack(side=tk.LEFT, padx=5)
        
        # Núcleo + Saída
        f2 = tk.Frame(tab, bg=BG)
        f2.pack(fill=tk.X, padx=10, pady=5)
        tk.Label(f2, text="Núcleo:", bg=BG, fg=FG).pack(side=tk.LEFT)
        self.var_nucleo = tk.StringVar(value="")
        tk.Entry(f2, textvariable=self.var_nucleo, font=FONT_MONO, bg=BG2, fg=FG, width=30).pack(side=tk.LEFT, padx=5)
        tk.Label(f2, text="Saída:", bg=BG, fg=FG).pack(side=tk.LEFT, padx=(20, 0))
        self.var_saida = tk.StringVar(value="./saida")
        tk.Entry(f2, textvariable=self.var_saida, font=FONT_MONO, bg=BG2, fg=FG, width=30).pack(side=tk.LEFT, padx=5)
        ttk.Button(f2, text="📂", command=lambda: self.var_saida.set(filedialog.askdirectory() or self.var_saida.get())).pack(side=tk.LEFT)
        
        # Botões
        f3 = tk.Frame(tab, bg=BG)
        f3.pack(fill=tk.X, padx=10, pady=10)
        ttk.Button(f3, text="▶ PIPELINE COMPLETO", style="Green.TButton", command=self._run_pipeline).pack(side=tk.LEFT, padx=3)
        ttk.Button(f3, text="📖 APENAS LER", command=self._apenas_ler).pack(side=tk.LEFT, padx=3)
        ttk.Button(f3, text="📂 ABRIR SAÍDA", command=lambda: subprocess.Popen(f'explorer "{self.var_saida.get()}"', shell=True)).pack(side=tk.LEFT, padx=3)
        ttk.Button(f3, text="🌐 EDITOR HTML", command=lambda: self._abrir_html("construdata_editor.html")).pack(side=tk.LEFT, padx=3)
        
        # Contrato
        f4 = tk.LabelFrame(tab, text="Contrato Ativo", bg=BG, fg=YEL, font=FONT_TITLE, padx=10, pady=10)
        f4.pack(fill=tk.X, padx=10, pady=5)
        ttk.Button(f4, text="➕ Novo Contrato", command=self._novo_contrato).pack(side=tk.LEFT, padx=3)
        ttk.Button(f4, text="🔄 Trocar Contrato", command=self._trocar_contrato).pack(side=tk.LEFT, padx=3)
        ttk.Button(f4, text="📋 SLNR Santos (pré-config)", command=self._criar_slnr).pack(side=tk.LEFT, padx=3)
        ttk.Button(f4, text="💰 Importar Preços", command=self._importar_precos).pack(side=tk.LEFT, padx=3)
    
    def _selecionar_arquivo(self):
        path = filedialog.askopenfilename(filetypes=[
            ("Todos suportados", "*.dxf *.dwg *.xml *.json *.pdf"),
            ("DXF ProSaneamento", "*.dxf"), ("DWG Civil 3D", "*.dwg"),
            ("LandXML", "*.xml"), ("JSON Rede", "*.json"), ("PDF Projeto", "*.pdf")])
        if path:
            self.var_arquivo.set(path)
            nome = Path(path).stem.replace("_", " ").title()
            if not self.var_nucleo.get():
                self.var_nucleo.set(nome)
    
    def _apenas_ler(self):
        path = self.var_arquivo.get()
        if not path:
            messagebox.showwarning("Aviso", "Selecione um arquivo")
            return
        self._run_async(self._ler_arquivo, path)
    
    def _ler_arquivo(self, path):
        self.log(f"Lendo: {path}")
        ext = Path(path).suffix.lower()
        
        if ext == ".dxf":
            from ler_dxf_gdal import ler_dxf_gdal
            ST.pvs, ST.trechos, ST.ruas, ST.meta = ler_dxf_gdal(path)
        elif ext == ".xml":
            from ler_landxml import ler_landxml
            ST.pvs, ST.trechos, ST.ruas, ST.meta = ler_landxml(path)
        elif ext == ".dwg":
            from ler_dwg_aec import ler_dwg_aec
            ST.pvs, ST.trechos, ST.meta = ler_dwg_aec(path)
            ST.ruas = []
        elif ext == ".json":
            with open(path) as f:
                data = json.load(f)
            ST.pvs = data.get("pvs", {})
            ST.trechos = data.get("trechos", [])
            ST.ruas = []
            ST.meta = data.get("meta", {})
        elif ext == ".pdf":
            try:
                from motor_llm import ler_pdf
                data = ler_pdf(path)
                ST.pvs = data.get("pvs", {})
                ST.trechos = data.get("trechos", [])
                ST.ruas = []
                ST.meta = {"fonte": "Gemini PDF"}
            except Exception as e:
                self.log(f"PDF: {e}. Configure Gemini API.", "WARN")
                return
        
        ST.arquivo = path
        ST.nucleo = self.var_nucleo.get() or Path(path).stem
        
        self.log(f"✅ {len(ST.pvs)} PVs | {len(ST.trechos)} trechos | {sum(t.get('ext_m',0) for t in ST.trechos):.0f}m")
        self.root.after(0, self._update_stats)
        self.root.after(0, self._refresh_tables)
    
    def _run_pipeline(self):
        path = self.var_arquivo.get()
        if not path:
            messagebox.showwarning("Aviso", "Selecione um arquivo")
            return
        self._run_async(self._pipeline_thread, path)
    
    def _pipeline_thread(self, path):
        self._ler_arquivo(path)
        if not ST.trechos:
            self.log("Sem trechos — pipeline cancelado", "WARN")
            return
        
        nucleo = self.var_nucleo.get() or ST.nucleo
        saida = self.var_saida.get() or "./saida"
        
        try:
            from construdata_pipeline import run_pipeline
            run_pipeline(path, nucleo, saida)
            self.log(f"✅ Pipeline completo! Saída: {saida}")
        except ImportError:
            self.log("construdata_pipeline.py não encontrado. Rodando módulos individuais...", "WARN")
            self._pipeline_manual(nucleo, saida)
    
    def _pipeline_manual(self, nucleo, saida):
        os.makedirs(saida, exist_ok=True)
        
        try:
            from gerar_ns import enriquecer_trechos, gerar_ns_a4, gerar_geojson
            tr_enr = enriquecer_trechos(ST.trechos, ST.pvs)
            ns_dir = os.path.join(saida, "01_NS")
            os.makedirs(ns_dir, exist_ok=True)
            for i, tr in enumerate(tr_enr[:5]):
                gerar_ns_a4(i+1, tr, ST.pvs, nucleo, os.path.join(ns_dir, f"NS_{i+1:03d}.pdf"))
            gerar_geojson(tr_enr, ST.pvs, os.path.join(ns_dir, "rede.geojson"))
            self.log(f"  NS: {len(tr_enr)} geradas")
        except Exception as e:
            self.log(f"  NS: {e}", "WARN")
        
        try:
            from gerar_ifc_lod500 import gerar_ifc_lod500
            ifc_dir = os.path.join(saida, "04_BIM_LOD500")
            gerar_ifc_lod500(ST.pvs, ST.trechos, nucleo, ifc_dir)
            self.log(f"  IFC LOD 500 gerado")
        except Exception as e:
            self.log(f"  IFC: {e}", "WARN")
        
        self.log(f"✅ Pipeline parcial concluído: {saida}")
    
    def _novo_contrato(self):
        win = tk.Toplevel(self.root)
        win.title("Novo Contrato")
        win.configure(bg=BG)
        win.geometry("400x350")
        
        fields = {}
        for i, (label, default) in enumerate([
            ("Nome", ""), ("Número", ""), ("Contratante", ""),
            ("Cidade", ""), ("Estado", "SP"), ("BDI %", "25"),
            ("R$/metro", "910"), ("Valor Contrato R$", "0")]):
            tk.Label(win, text=label, bg=BG, fg=FG).grid(row=i, column=0, padx=5, pady=2, sticky="e")
            e = tk.Entry(win, font=FONT_MONO, bg=BG2, fg=FG, width=30)
            e.insert(0, default)
            e.grid(row=i, column=1, padx=5, pady=2)
            fields[label] = e
        
        def criar():
            try:
                from motor_contratos import criar_contrato
                criar_contrato(
                    nome=fields["Nome"].get(), numero=fields["Número"].get(),
                    contratante=fields["Contratante"].get(), cidade=fields["Cidade"].get(),
                    estado=fields["Estado"].get(), bdi=float(fields["BDI %"].get() or 25),
                    custo_metro=float(fields["R$/metro"].get() or 910),
                    valor_contrato=float(fields["Valor Contrato R$"].get() or 0))
                self._check_contrato()
                self.log(f"✅ Contrato criado: {fields['Nome'].get()}")
                win.destroy()
            except Exception as e:
                messagebox.showerror("Erro", str(e))
        
        ttk.Button(win, text="✅ Criar", command=criar).grid(row=8, column=0, columnspan=2, pady=10)
    
    def _trocar_contrato(self):
        try:
            from motor_contratos import listar_contratos, ativar_contrato
            contratos = listar_contratos()
            if not contratos:
                messagebox.showinfo("Info", "Nenhum contrato. Crie um primeiro.")
                return
            
            win = tk.Toplevel(self.root)
            win.title("Trocar Contrato")
            win.configure(bg=BG)
            
            for i, c in enumerate(contratos):
                marca = " ◄ ATIVO" if c["ativo"] else ""
                btn = ttk.Button(win, text=f"{c['nome']} ({c['cidade']}/{c['estado']}){marca}",
                    command=lambda s=c["slug"]: [ativar_contrato(s), self._check_contrato(), win.destroy()])
                btn.pack(fill=tk.X, padx=10, pady=2)
        except Exception as e:
            messagebox.showerror("Erro", str(e))
    
    def _criar_slnr(self):
        try:
            from motor_contratos import criar_slnr_santos
            criar_slnr_santos()
            self._check_contrato()
            self.log("✅ SLNR Santos criado")
        except Exception as e:
            self.log(f"SLNR: {e}", "WARN")
    
    def _importar_precos(self):
        path = filedialog.askopenfilename(filetypes=[("CSV/JSON", "*.csv *.json")])
        if path and ST.contrato_slug:
            try:
                from motor_contratos import importar_precos
                importar_precos(ST.contrato_slug, path)
                self.log(f"✅ Preços importados: {path}")
            except Exception as e:
                self.log(f"Preços: {e}", "WARN")
    
    def _abrir_html(self, nome):
        html_dir = Path(__file__).parent / "html"
        path = html_dir / nome
        if path.exists():
            webbrowser.open(str(path))
        else:
            self.log(f"HTML não encontrado: {path}", "WARN")
    
    # ══════════════════════════════════════════════════════
    # TAB 2: MAPA
    # ══════════════════════════════════════════════════════
    def _build_tab_mapa(self):
        tab = tk.Frame(self.nb, bg=BG)
        self.nb.add(tab, text="🗺️ Mapa")
        
        try:
            import tkintermapview
            self.map_widget = tkintermapview.TkinterMapView(tab, width=800, height=600)
            self.map_widget.pack(fill=tk.BOTH, expand=True)
            self.map_widget.set_position(-23.96, -46.33)
            self.map_widget.set_zoom(14)
            self.map_widget.set_tile_server("https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}")
        except ImportError:
            tk.Label(tab, text="pip install tkintermapview\npara ativar o mapa", bg=BG, fg=YEL, font=FONT_TITLE).pack(expand=True)
    
    # ══════════════════════════════════════════════════════
    # TAB 3: REDE
    # ══════════════════════════════════════════════════════
    def _build_tab_rede(self):
        tab = tk.Frame(self.nb, bg=BG)
        self.nb.add(tab, text="🔵 Rede")
        
        cards = tk.Frame(tab, bg=BG)
        cards.pack(fill=tk.X, padx=10, pady=5)
        for i in range(5): cards.columnconfigure(i, weight=1)
        
        self.card_pvs = self._make_card(cards, "PVs", "0", ACC, 0, 0)
        self.card_trechos = self._make_card(cards, "TRECHOS", "0", AGUA, 0, 1)
        self.card_ext = self._make_card(cards, "EXTENSÃO", "0m", YEL, 0, 2)
        self.card_tipo = self._make_card(cards, "TIPO", "—", ACC, 0, 3)
        self.card_ruas = self._make_card(cards, "RUAS", "0", DIM, 0, 4)
        
        cols = ("Nome", "X", "Y", "CT", "CF", "Prof", "Tipo")
        self.tree_pvs = ttk.Treeview(tab, columns=cols, show="headings", height=20)
        for c in cols:
            self.tree_pvs.heading(c, text=c)
            self.tree_pvs.column(c, width=100)
        self.tree_pvs.pack(fill=tk.BOTH, expand=True, padx=10, pady=5)
    
    # ══════════════════════════════════════════════════════
    # TAB 4: HIDRÁULICA
    # ══════════════════════════════════════════════════════
    def _build_tab_hidraulica(self):
        tab = tk.Frame(self.nb, bg=BG)
        self.nb.add(tab, text="💧 Hidráulica")
        
        cards = tk.Frame(tab, bg=BG)
        cards.pack(fill=tk.X, padx=10, pady=5)
        for i in range(4): cards.columnconfigure(i, weight=1)
        self.card_hid_ok = self._make_card(cards, "OK", "0", ACC, 0, 0)
        self.card_hid_warn = self._make_card(cards, "VERIFICAR", "0", YEL, 0, 1)
        self.card_hid_nodata = self._make_card(cards, "SEM DADOS", "0", DIM, 0, 2)
        self.card_hid_n = self._make_card(cards, "MANNING n", "0.013", AGUA, 0, 3)
        
        cols = ("NS", "PV Ini", "PV Fim", "DN", "Ext", "Decl‰", "V m/s", "Q L/s", "τ Pa", "Status")
        self.tree_hid = ttk.Treeview(tab, columns=cols, show="headings", height=20)
        for c in cols:
            self.tree_hid.heading(c, text=c)
            self.tree_hid.column(c, width=80)
        self.tree_hid.pack(fill=tk.BOTH, expand=True, padx=10, pady=5)
    
    # ══════════════════════════════════════════════════════
    # TAB 5: TRECHOS
    # ══════════════════════════════════════════════════════
    def _build_tab_trechos(self):
        tab = tk.Frame(self.nb, bg=BG)
        self.nb.add(tab, text="📋 Trechos")
        
        cols = ("NS", "PV Ini", "PV Fim", "Rua", "DN", "Ext", "Material", "CT ini", "CF ini", "Prof", "Custo R$")
        self.tree_trechos = ttk.Treeview(tab, columns=cols, show="headings", height=25)
        for c in cols:
            self.tree_trechos.heading(c, text=c)
            self.tree_trechos.column(c, width=90)
        sb = ttk.Scrollbar(tab, orient=tk.VERTICAL, command=self.tree_trechos.yview)
        self.tree_trechos.configure(yscrollcommand=sb.set)
        self.tree_trechos.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=10, pady=5)
        sb.pack(side=tk.RIGHT, fill=tk.Y)
    
    # ══════════════════════════════════════════════════════
    # TAB 6: CUSTOS 5D
    # ══════════════════════════════════════════════════════
    def _build_tab_custos(self):
        tab = tk.Frame(self.nb, bg=BG)
        self.nb.add(tab, text="💰 Custos 5D")
        
        cards = tk.Frame(tab, bg=BG)
        cards.pack(fill=tk.X, padx=10, pady=5)
        for i in range(5): cards.columnconfigure(i, weight=1)
        self.card_custo_total = self._make_card(cards, "CUSTO TOTAL", "R$ 0", ACC, 0, 0)
        self.card_custo_metro = self._make_card(cards, "R$/METRO", "0", AGUA, 0, 1)
        self.card_bdi = self._make_card(cards, "BDI", "25%", YEL, 0, 2)
        self.card_ext2 = self._make_card(cards, "EXTENSÃO", "0m", DIM, 0, 3)
        self.card_bms = self._make_card(cards, "BMs", "0", ACC, 0, 4)
        
        btns = tk.Frame(tab, bg=BG)
        btns.pack(fill=tk.X, padx=10, pady=5)
        ttk.Button(btns, text="📊 CALCULAR CUSTOS", style="Green.TButton", command=self._calcular_custos).pack(side=tk.LEFT, padx=3)
        ttk.Button(btns, text="📋 GERAR BM", command=self._gerar_bm).pack(side=tk.LEFT, padx=3)
        ttk.Button(btns, text="📈 CURVA S", command=self._curva_s).pack(side=tk.LEFT, padx=3)
        ttk.Button(btns, text="🗺️ MICRO-PLAN", command=self._micro_plan).pack(side=tk.LEFT, padx=3)
        ttk.Button(btns, text="🤖 RELATÓRIO ML", command=self._relatorio_ml).pack(side=tk.LEFT, padx=3)
        ttk.Button(btns, text="📅 CRONO MACRO", command=self._crono_macro).pack(side=tk.LEFT, padx=3)
        
        self.text_custos = scrolledtext.ScrolledText(tab, bg=BG2, fg=FG, font=FONT_MONO, height=15)
        self.text_custos.pack(fill=tk.BOTH, expand=True, padx=10, pady=5)
    
    # ══════════════════════════════════════════════════════
    # TAB 7: BIM / CIVIL 3D
    # ══════════════════════════════════════════════════════
    def _build_tab_bim(self):
        tab = tk.Frame(self.nb, bg=BG)
        self.nb.add(tab, text="🏗️ BIM/Civil3D")
        
        f1 = tk.LabelFrame(tab, text="Geradores", bg=BG, fg=ACC, font=FONT_TITLE, padx=10, pady=10)
        f1.pack(fill=tk.X, padx=10, pady=5)
        for text, cmd in [
            ("▶ GERAR TUDO", self._gerar_tudo_bim),
            ("🏗️ IFC LOD500", lambda: self._gerar_modulo("ifc")),
            ("📐 LandXML", lambda: self._gerar_modulo("landxml")),
            ("📋 Cadastro NTS292", lambda: self._gerar_modulo("nts292")),
            ("📐 Cadastro DXF", lambda: self._gerar_modulo("dxf")),
            ("📅 Cronograma", lambda: self._gerar_modulo("crono")),
            ("🔧 Dynamo", lambda: self._gerar_modulo("dynamo")),
            ("📝 SCR AutoCAD", lambda: self._gerar_modulo("scr")),
        ]:
            ttk.Button(f1, text=text, command=cmd).pack(side=tk.LEFT, padx=3)
        
        f2 = tk.LabelFrame(tab, text="Interfaces HTML", bg=BG, fg=AGUA, font=FONT_TITLE, padx=10, pady=10)
        f2.pack(fill=tk.X, padx=10, pady=5)
        for text, html in [
            ("🖱️ Editor EPANET", "construdata_editor.html"),
            ("🌐 Viewer 3D", "construdata_manage.html"),
            ("📊 Controle As-Built", "construdata_controle.html"),
            ("📋 RDO Diário", "construdata_rdo.html"),
            ("💧 Gestão Perdas", "construdata_perdas.html"),
            ("📐 Fluxograma", "FLUXOGRAMA_BIM_5D.html"),
            ("🏛️ Arquitetura", "ARQUITETURA_BIM_5D.html"),
        ]:
            ttk.Button(f2, text=text, command=lambda h=html: self._abrir_html(h)).pack(side=tk.LEFT, padx=3)
        
        self.text_bim = scrolledtext.ScrolledText(tab, bg=BG2, fg=FG, font=FONT_MONO, height=15)
        self.text_bim.pack(fill=tk.BOTH, expand=True, padx=10, pady=5)
    
    # ══════════════════════════════════════════════════════
    # TAB 8: LEAN / LPS
    # ══════════════════════════════════════════════════════
    def _build_tab_lean(self):
        tab = tk.Frame(self.nb, bg=BG)
        self.nb.add(tab, text="📐 Lean/LPS")
        
        cards = tk.Frame(tab, bg=BG)
        cards.pack(fill=tk.X, padx=10, pady=5)
        for i in range(6): cards.columnconfigure(i, weight=1)
        self.card_takt = self._make_card(cards, "TAKT (dias)", "—", ACC, 0, 0)
        self.card_cycle = self._make_card(cards, "CYCLE TIME", "—", AGUA, 0, 1)
        self.card_ppc = self._make_card(cards, "PPC %", "—", YEL, 0, 2)
        self.card_va = self._make_card(cards, "VA/NVA", "—", ACC, 0, 3)
        self.card_co2 = self._make_card(cards, "CO2 (ton)", "—", RED, 0, 4)
        self.card_cv = self._make_card(cards, "CUSTO 50a", "—", AGUA, 0, 5)
        
        btns = tk.Frame(tab, bg=BG)
        btns.pack(fill=tk.X, padx=10, pady=5)
        ttk.Button(btns, text="📊 RELATÓRIO LEAN+LPS", style="Green.TButton", command=self._relatorio_lean).pack(side=tk.LEFT, padx=3)
        ttk.Button(btns, text="⏱️ TAKT TIME", command=self._takt_time).pack(side=tk.LEFT, padx=3)
        ttk.Button(btns, text="📅 LOOKAHEAD 6 SEM", command=self._lookahead).pack(side=tk.LEFT, padx=3)
        ttk.Button(btns, text="🔄 BIM 6D (Ciclo Vida)", command=self._bim_6d).pack(side=tk.LEFT, padx=3)
        
        self.text_lean = scrolledtext.ScrolledText(tab, bg=BG2, fg=FG, font=FONT_MONO, height=15)
        self.text_lean.pack(fill=tk.BOTH, expand=True, padx=10, pady=5)
    
    # ══════════════════════════════════════════════════════
    # TAB 9: PERDAS
    # ══════════════════════════════════════════════════════
    def _build_tab_perdas(self):
        tab = tk.Frame(self.nb, bg=BG)
        self.nb.add(tab, text="💧 Perdas")
        
        cards = tk.Frame(tab, bg=BG)
        cards.pack(fill=tk.X, padx=10, pady=5)
        for i in range(6): cards.columnconfigure(i, weight=1)
        self.card_uarl = self._make_card(cards, "UARL m³/ano", "—", AGUA, 0, 0)
        self.card_ili = self._make_card(cards, "ILI", "—", YEL, 0, 1)
        self.card_ili_cls = self._make_card(cards, "CLASSIF.", "—", ACC, 0, 2)
        self.card_risco = self._make_card(cards, "RISCO ALTO", "0", RED, 0, 3)
        self.card_dmas = self._make_card(cards, "DMAs", "0", AGUA, 0, 4)
        self.card_perda_rs = self._make_card(cards, "PERDA R$/ano", "—", RED, 0, 5)
        
        btns = tk.Frame(tab, bg=BG)
        btns.pack(fill=tk.X, padx=10, pady=5)
        ttk.Button(btns, text="📊 RELATÓRIO PERDAS", style="Green.TButton", command=self._relatorio_perdas).pack(side=tk.LEFT, padx=3)
        ttk.Button(btns, text="⚠️ MAPA RISCO", command=self._mapa_risco).pack(side=tk.LEFT, padx=3)
        ttk.Button(btns, text="🗺️ CRIAR DMAs", command=self._criar_dmas).pack(side=tk.LEFT, padx=3)
        ttk.Button(btns, text="📄 PDF PERDAS", command=self._pdf_perdas).pack(side=tk.LEFT, padx=3)
        ttk.Button(btns, text="🔄 ANÁLISE TROCA", command=self._analise_troca).pack(side=tk.LEFT, padx=3)
        
        self.text_perdas = scrolledtext.ScrolledText(tab, bg=BG2, fg=FG, font=FONT_MONO, height=15)
        self.text_perdas.pack(fill=tk.BOTH, expand=True, padx=10, pady=5)
    
    # ══════════════════════════════════════════════════════
    # TAB 10: IA (4 LLMs)
    # ══════════════════════════════════════════════════════
    def _build_tab_ia(self):
        tab = tk.Frame(self.nb, bg=BG)
        self.nb.add(tab, text="🤖 IA")
        
        # Status
        f1 = tk.LabelFrame(tab, text="LLMs Gratuitos", bg=BG, fg=ACC, font=FONT_TITLE, padx=10, pady=5)
        f1.pack(fill=tk.X, padx=10, pady=5)
        self.lbl_ia_status = tk.Label(f1, text="Execute: python motor_llm.py setup", bg=BG, fg=DIM, font=FONT_MONO)
        self.lbl_ia_status.pack(anchor="w")
        ttk.Button(f1, text="⚙️ Configurar Keys", command=self._setup_llm).pack(side=tk.RIGHT)
        ttk.Button(f1, text="🔄 Verificar Status", command=self._check_llm).pack(side=tk.RIGHT, padx=3)
        
        # Pergunta
        f2 = tk.Frame(tab, bg=BG)
        f2.pack(fill=tk.X, padx=10, pady=5)
        tk.Label(f2, text="Pergunta:", bg=BG, fg=FG).pack(side=tk.LEFT)
        self.var_pergunta = tk.StringVar()
        tk.Entry(f2, textvariable=self.var_pergunta, font=FONT_MONO, bg=BG2, fg=FG, width=60).pack(side=tk.LEFT, padx=5, fill=tk.X, expand=True)
        ttk.Button(f2, text="▶ Perguntar", style="Green.TButton", command=self._perguntar_ia).pack(side=tk.LEFT, padx=3)
        
        # Botões rápidos
        f3 = tk.Frame(tab, bg=BG)
        f3.pack(fill=tk.X, padx=10, pady=5)
        for text, cmd in [
            ("📊 Resumo Executivo", self._ia_resumo),
            ("💧 Validar Hidráulica", self._ia_hidraulica),
            ("📉 Analisar Perdas", self._ia_perdas),
            ("🤖 Explicar ML", self._ia_ml),
            ("📸 Analisar Foto", self._ia_foto),
            ("📄 Ler PDF", self._ia_pdf),
        ]:
            ttk.Button(f3, text=text, command=cmd).pack(side=tk.LEFT, padx=3)
        
        self.text_ia = scrolledtext.ScrolledText(tab, bg=BG2, fg=FG, font=FONT_MONO, height=20)
        self.text_ia.pack(fill=tk.BOTH, expand=True, padx=10, pady=5)
    
    # ══════════════════════════════════════════════════════
    # TAB 11: NÚCLEOS
    # ══════════════════════════════════════════════════════
    def _build_tab_nucleos(self):
        tab = tk.Frame(self.nb, bg=BG)
        self.nb.add(tab, text="🏘️ Núcleos")
        
        btns = tk.Frame(tab, bg=BG)
        btns.pack(fill=tk.X, padx=10, pady=5)
        ttk.Button(btns, text="▶ BATCH NÚCLEOS DXF", style="Green.TButton", command=self._batch_nucleos).pack(side=tk.LEFT, padx=3)
        ttk.Button(btns, text="▶ BATCH PROLONGAMENTOS", style="Blue.TButton", command=self._batch_prolongamentos).pack(side=tk.LEFT, padx=3)
        ttk.Button(btns, text="▶ BATCH TUDO", style="Green.TButton", command=self._batch_tudo).pack(side=tk.LEFT, padx=3)
        
        cols = ("Nome", "Tipo", "PVs", "Trechos", "Extensão", "Status")
        self.tree_nucleos = ttk.Treeview(tab, columns=cols, show="headings", height=15)
        for c in cols:
            self.tree_nucleos.heading(c, text=c)
            self.tree_nucleos.column(c, width=120)
        self.tree_nucleos.pack(fill=tk.BOTH, expand=True, padx=10, pady=5)
    
    # ══════════════════════════════════════════════════════
    # TAB 12: LOG
    # ══════════════════════════════════════════════════════
    def _build_tab_log(self):
        tab = tk.Frame(self.nb, bg=BG)
        self.nb.add(tab, text="📝 Log")
        
        btns = tk.Frame(tab, bg=BG)
        btns.pack(fill=tk.X, padx=10, pady=5)
        ttk.Button(btns, text="🗑️ Limpar", command=lambda: self.log_text.delete(1.0, tk.END)).pack(side=tk.LEFT, padx=3)
        ttk.Button(btns, text="📋 Copiar", command=lambda: self.root.clipboard_append(self.log_text.get(1.0, tk.END))).pack(side=tk.LEFT, padx=3)
        
        self.log_text = scrolledtext.ScrolledText(tab, bg=BG2, fg=FG, font=FONT_MONO, height=30)
        self.log_text.pack(fill=tk.BOTH, expand=True, padx=10, pady=5)
    
    # ══════════════════════════════════════════════════════
    # REFRESH TABLES
    # ══════════════════════════════════════════════════════
    def _refresh_tables(self):
        # Cards Rede
        self.card_pvs.config(text=str(len(ST.pvs)))
        self.card_trechos.config(text=str(len(ST.trechos)))
        ext = round(sum(t.get("ext_m", 0) for t in ST.trechos), 0)
        self.card_ext.config(text=f"{ext}m")
        tipo = ST.meta.get("tipo", "esgoto") if ST.meta else "—"
        self.card_tipo.config(text=tipo.upper())
        self.card_ruas.config(text=str(len(ST.ruas)))
        
        # Tabela PVs
        self.tree_pvs.delete(*self.tree_pvs.get_children())
        for nome, pv in list(ST.pvs.items())[:500]:
            ct = pv.get("ct") or 0
            cf = pv.get("cf") or 0
            prof = round(ct - cf, 2) if ct and cf else "—"
            self.tree_pvs.insert("", tk.END, values=(
                nome, f"{pv.get('x',0):.1f}", f"{pv.get('y',0):.1f}",
                f"{ct:.2f}" if ct else "—", f"{cf:.2f}" if cf else "—",
                prof, pv.get("tipo", "esg")))
        
        # Tabela Hidráulica
        self.tree_hid.delete(*self.tree_hid.get_children())
        ok = warn = nodata = 0
        for i, t in enumerate(ST.trechos[:500]):
            v = t.get("v_ms", 0)
            q = t.get("q_ls", 0)
            tau = t.get("tau_pa", 0)
            if v > 0:
                status = "OK" if (0.6 <= v <= 5 and tau >= 1) else "VERIFICAR"
                if status == "OK": ok += 1
                else: warn += 1
            else:
                status = "SEM DADOS"
                nodata += 1
            self.tree_hid.insert("", tk.END, values=(
                f"NS_{i+1:03d}", t.get("pv_ini",""), t.get("pv_fim",""),
                t.get("dn_mm",""), f"{t.get('ext_m',0):.1f}",
                f"{t.get('decl_mm',0):.1f}", f"{v:.3f}", f"{q:.3f}", f"{tau:.1f}", status))
        self.card_hid_ok.config(text=str(ok))
        self.card_hid_warn.config(text=str(warn))
        self.card_hid_nodata.config(text=str(nodata))
        
        # Tabela Trechos
        self.tree_trechos.delete(*self.tree_trechos.get_children())
        for i, t in enumerate(ST.trechos[:500]):
            p0 = ST.pvs.get(t.get("pv_ini"), {})
            custo = round(t.get("ext_m", 0) * 910, 0)
            self.tree_trechos.insert("", tk.END, values=(
                f"NS_{i+1:03d}", t.get("pv_ini",""), t.get("pv_fim",""),
                t.get("rua",""), t.get("dn_mm",""), f"{t.get('ext_m',0):.1f}",
                t.get("material",""), f"{p0.get('ct',0):.2f}" if p0.get('ct') else "—",
                f"{p0.get('cf',0):.2f}" if p0.get('cf') else "—",
                f"{(p0.get('ct',0) or 0)-(p0.get('cf',0) or 0):.2f}" if p0.get('ct') else "—",
                f"R$ {custo:,.0f}"))
    
    # ══════════════════════════════════════════════════════
    # AÇÕES DOS BOTÕES (delegam pros motores)
    # ══════════════════════════════════════════════════════
    def _calcular_custos(self):
        if not ST.trechos: return
        def run():
            try:
                from motor_custo import custo_nucleo
                cn = custo_nucleo(ST.pvs, ST.trechos, ST.nucleo)
                self.root.after(0, lambda: self.card_custo_total.config(text=f"R$ {cn['total']:,.0f}"))
                self.root.after(0, lambda: self.card_custo_metro.config(text=f"R$ {cn['custo_medio_metro']:.0f}"))
                self.root.after(0, lambda: self.card_ext2.config(text=f"{cn['extensao_total']}m"))
                self.root.after(0, lambda: self.text_custos.insert(tk.END, json.dumps(cn["resumo_servicos"], indent=2, ensure_ascii=False)+"\n"))
                self.log(f"Custo: R$ {cn['total']:,.0f} ({cn['custo_medio_metro']:.0f}/m)")
            except Exception as e:
                self.log(f"Custo: {e}", "ERROR")
        self._run_async(run)
    
    def _gerar_bm(self):
        self.log("Gerar BM — selecione trechos executados primeiro")
    
    def _curva_s(self):
        if not ST.trechos: return
        try:
            from motor_medicao import gerar_curva_s
            curva = gerar_curva_s(ST.trechos)
            self.text_custos.insert(tk.END, f"Curva S: {json.dumps(curva['previsto'][:3], indent=2)}\n")
        except Exception as e:
            self.log(f"Curva S: {e}", "ERROR")
    
    def _micro_plan(self):
        if not ST.trechos: return
        def run():
            try:
                from motor_microplanejamento import micro_planejar_nucleo
                mp = micro_planejar_nucleo(ST.pvs, ST.trechos, ST.nucleo, 4)
                self.root.after(0, lambda: self.text_custos.insert(tk.END,
                    f"MICRO-PLANEJAMENTO:\n{json.dumps(mp['por_morfologia'], indent=2, ensure_ascii=False)}\n\nRECOMENDAÇÕES:\n{json.dumps(mp['recomendacoes'], indent=2, ensure_ascii=False)}\n"))
                self.log(f"Micro-plan: {len(mp['recomendacoes'])} recomendações")
            except Exception as e:
                self.log(f"MicroPlan: {e}", "ERROR")
        self._run_async(run)
    
    def _relatorio_ml(self):
        def run():
            try:
                from motor_ml import gerar_relatorio_ml
                rel = gerar_relatorio_ml({}, saldo_total_m=25730)
                self.root.after(0, lambda: self.text_custos.insert(tk.END, json.dumps(rel["cenarios"], indent=2, ensure_ascii=False)+"\n"))
            except Exception as e:
                self.log(f"ML: {e}", "ERROR")
        self._run_async(run)
    
    def _crono_macro(self):
        def run():
            try:
                from gerar_cronograma_macro import gerar_tudo
                nucleos = [
                    {"nome":"Verde e Teteu","extensao_m":2621,"n_trechos":180,"equipes":3},
                    {"nome":"Pantanal Baixo","extensao_m":6720,"n_trechos":189,"equipes":3},
                    {"nome":"Vila Israel","extensao_m":11509,"n_trechos":861,"equipes":3},
                ]
                wbs, paths = gerar_tudo(nucleos, "2026-04-01", "./cronograma")
                self.log(f"Cronograma macro: {len(paths)} arquivos gerados")
            except Exception as e:
                self.log(f"Crono: {e}", "ERROR")
        self._run_async(run)
    
    def _gerar_tudo_bim(self):
        self._run_async(self._pipeline_manual, ST.nucleo, self.var_saida.get())
    
    def _gerar_modulo(self, modulo):
        self.log(f"Gerando {modulo}...")
        saida = self.var_saida.get()
        os.makedirs(saida, exist_ok=True)
        def run():
            try:
                if modulo == "ifc":
                    from gerar_ifc_lod500 import gerar_ifc_lod500
                    gerar_ifc_lod500(ST.pvs, ST.trechos, ST.nucleo, saida)
                elif modulo == "landxml":
                    from gerar_civil3d import gerar_landxml
                    gerar_landxml(ST.pvs, ST.trechos, ST.nucleo, os.path.join(saida, f"{ST.nucleo}.xml"))
                elif modulo == "nts292":
                    from gerar_cadastro_nts292 import gerar_cadastro_nts292
                    gerar_cadastro_nts292(ST.pvs, ST.trechos, ST.nucleo, saida)
                elif modulo == "crono":
                    from gerar_project_xml import gerar_project_xml
                    gerar_project_xml(ST.pvs, ST.trechos, ST.nucleo, saida)
                self.log(f"✅ {modulo} gerado em {saida}")
            except Exception as e:
                self.log(f"{modulo}: {e}", "ERROR")
        self._run_async(run)
    
    def _relatorio_lean(self):
        if not ST.trechos: return
        def run():
            try:
                from motor_lean_lps import gerar_relatorio_lean_lps
                rel = gerar_relatorio_lean_lps(ST.pvs, ST.trechos, nucleo=ST.nucleo)
                d6 = rel["bim_6d"]
                lean = rel["lean"]
                self.root.after(0, lambda: [
                    self.card_takt.config(text=f"{lean['takt_time']['cycle_time_dias']}d"),
                    self.card_cycle.config(text=f"{lean['takt_time']['throughput_ns_semana']:.0f}/sem"),
                    self.card_co2.config(text=f"{d6['co2_total_ton']:.1f}"),
                    self.card_cv.config(text=f"R$ {d6['custo_ciclo_vida_total']:,.0f}"),
                    self.text_lean.insert(tk.END, json.dumps(rel, indent=2, ensure_ascii=False, default=str)+"\n"),
                ])
                self.log("Lean+LPS+6D calculado")
            except Exception as e:
                self.log(f"Lean: {e}", "ERROR")
        self._run_async(run)
    
    def _takt_time(self): self._relatorio_lean()
    def _lookahead(self): self._relatorio_lean()
    def _bim_6d(self): self._relatorio_lean()
    
    def _relatorio_perdas(self):
        if not ST.trechos: return
        def run():
            try:
                from motor_perdas import gerar_relatorio_perdas
                rel = gerar_relatorio_perdas(ST.pvs, ST.trechos, ST.nucleo, pressao_media=35)
                u = rel["uarl"]
                self.root.after(0, lambda: [
                    self.card_uarl.config(text=f"{u['uarl_m3_ano']:,.0f}"),
                    self.card_dmas.config(text=str(rel['dmas'].get('n_dmas', 0))),
                    self.card_perda_rs.config(text=f"R$ {rel['projecao_economica']['custo_perdas_ano_estimado']:,.0f}"),
                    self.text_perdas.insert(tk.END, json.dumps(rel, indent=2, ensure_ascii=False, default=str)+"\n"),
                ])
                self.log(f"Perdas: UARL={u['uarl_m3_ano']:,.0f} m³/ano")
            except Exception as e:
                self.log(f"Perdas: {e}", "ERROR")
        self._run_async(run)
    
    def _mapa_risco(self): self._relatorio_perdas()
    def _criar_dmas(self): self._relatorio_perdas()
    
    def _pdf_perdas(self):
        if not ST.trechos: return
        def run():
            try:
                from motor_perdas import gerar_relatorio_perdas
                from gerar_pdf_perdas import gerar_pdf_perdas
                rel = gerar_relatorio_perdas(ST.pvs, ST.trechos, ST.nucleo, pressao_media=35)
                out = filedialog.asksaveasfilename(defaultextension=".pdf", filetypes=[("PDF", "*.pdf")])
                if out:
                    gerar_pdf_perdas(rel, out, ST.nucleo)
                    self.log(f"✅ PDF gerado: {out}")
            except Exception as e:
                self.log(f"PDF: {e}", "ERROR")
        self._run_async(run)
    
    def _analise_troca(self):
        self.log("Análise trocar vs manter — use motor_perdas.analise_troca_vs_perda()")
    
    # IA
    def _setup_llm(self):
        """Abre janela modal para configurar API keys dos 4 LLMs."""
        win = tk.Toplevel(self.root)
        win.title("Configurar API Keys — LLMs Gratuitos")
        win.geometry("650x520")
        win.configure(bg=BG)
        win.transient(self.root)
        win.grab_set()

        tk.Label(win, text="Configurar API Keys — 4 LLMs Gratuitos",
                 font=FONT_TITLE, bg=BG, fg=ACC).pack(padx=16, pady=(16, 8))

        instr = tk.Label(win, text="Todas as APIs sao GRATUITAS. Clique nos links para obter suas keys:",
                         font=FONT_TEXT, bg=BG, fg=FG, justify=tk.LEFT)
        instr.pack(padx=16, pady=(0, 12), anchor=tk.W)

        main = tk.Frame(win, bg=BG)
        main.pack(fill=tk.BOTH, expand=True, padx=16, pady=8)

        providers = [
            ("Gemini Flash", "#4285f4", "https://aistudio.google.com/app/apikey", "500 req/dia", "gemini"),
            ("Groq Llama 3.3", "#f55036", "https://console.groq.com/keys", "30 req/min", "groq"),
            ("Mistral Large", "#ff7000", "https://console.mistral.ai/api-keys", "1M tokens/mês", "mistral"),
            ("Cohere Command-R", "#39594d", "https://dashboard.cohere.com/api-keys", "1000 req/mês", "cohere"),
        ]

        key_entries = {}
        key_status = {}

        for nome, cor, url, limite, provider_id in providers:
            frame = tk.LabelFrame(main, text=f" {nome} — {limite} ",
                                  font=("Segoe UI", 9, "bold"), bg=BG2, fg=cor, bd=1)
            frame.pack(fill=tk.X, pady=6)

            link = tk.Label(frame, text=url, font=("Segoe UI", 8), bg=BG2, fg=BLUE, cursor="hand2")
            link.pack(padx=10, pady=(4, 0), anchor=tk.W)
            link.bind("<Button-1>", lambda e, u=url: webbrowser.open(u))

            row = tk.Frame(frame, bg=BG2)
            row.pack(fill=tk.X, padx=10, pady=6)

            tk.Label(row, text="API Key:", bg=BG2, fg=FG, width=8).pack(side=tk.LEFT)
            entry = tk.Entry(row, bg=BG2, fg=FG, insertbackground=FG, relief=tk.FLAT, bd=2, font=FONT_MONO)
            entry.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=4)

            def toggle_visibility(e=entry):
                if e.cget('show') == '*':
                    e.config(show='')
                else:
                    e.config(show='*')

            eye_btn = tk.Button(row, text="👁", command=lambda e=entry: toggle_visibility(e),
                               bg=BG2, fg=FG, relief=tk.FLAT, width=2)
            eye_btn.pack(side=tk.RIGHT, padx=2)

            status_lbl = tk.Label(row, text="⬚ Sem key", bg=BG2, fg=DIM, font=("Segoe UI", 8))
            status_lbl.pack(side=tk.RIGHT, padx=8)

            try:
                from motor_llm import _get_key
                existing = _get_key(provider_id)
                if existing:
                    entry.insert(0, existing)
                    status_lbl.config(text="✅ Configurada", fg=ACC)
            except:
                pass

            key_entries[provider_id] = entry
            key_status[provider_id] = status_lbl

        btn_row = tk.Frame(win, bg=BG)
        btn_row.pack(padx=16, pady=12)

        def salvar():
            from motor_llm import _load_config, _save_config, PROVIDERS
            config = _load_config()
            salvas = 0
            for provider_id, entry in key_entries.items():
                key = entry.get().strip()
                if key:
                    config[f"{provider_id}_api_key"] = key
                    os.environ[PROVIDERS[provider_id]["env_key"]] = key
                    salvas += 1
                    key_status[provider_id].config(text="✅ Salva", fg=ACC)
            _save_config(config)
            self._check_llm()
            messagebox.showinfo("Sucesso", f"{salvas} API key(s) configurada(s)!", parent=win)

        def testar():
            from motor_llm import CALL_MAP, PROVIDERS
            resultados = []
            for provider_id, entry in key_entries.items():
                key = entry.get().strip()
                if not key:
                    resultados.append(f"⬚ {provider_id}: sem key")
                    continue
                try:
                    resp = CALL_MAP[provider_id]("Responda apenas: CONECTADO", system="Seja breve")
                    resultados.append(f"✅ {provider_id}: {resp[:30]}")
                    key_status[provider_id].config(text="✅ OK", fg=ACC)
                except Exception as e:
                    resultados.append(f"❌ {provider_id}: {str(e)[:50]}")
                    key_status[provider_id].config(text="❌ Erro", fg="red")

            msg = "\n".join(resultados)
            self.text_ia.insert(tk.END, f"\nTeste de conexão:\n{msg}\n{'═'*60}\n")

        ttk.Button(btn_row, text="💾 Salvar Keys", command=salvar, style="Green.TButton").pack(side=tk.LEFT, padx=4)
        ttk.Button(btn_row, text="📡 Testar Conexão", command=testar, style="Blue.TButton").pack(side=tk.LEFT, padx=4)
        ttk.Button(btn_row, text="Fechar", command=win.destroy).pack(side=tk.RIGHT, padx=4)
    
    def _check_llm(self):
        try:
            from motor_llm import status_rapido
            st = status_rapido()
            txt = " · ".join(f"{'✅' if v else '❌'} {k}" for k, v in st.items())
            self.lbl_ia_status.config(text=txt)
        except Exception as e:
            self.lbl_ia_status.config(text=f"Erro: {e}")
    
    def _ia_call(self, func_name, *args):
        def run():
            try:
                import motor_llm
                func = getattr(motor_llm, func_name)
                result = func(*args)
                self.root.after(0, lambda: self.text_ia.insert(tk.END, f"\n{'═'*60}\n{result}\n"))
            except Exception as e:
                self.root.after(0, lambda: self.text_ia.insert(tk.END, f"\n❌ {e}\n"))
        self._run_async(run)
    
    def _perguntar_ia(self):
        q = self.var_pergunta.get()
        if not q: return
        ctx = f"PVs:{len(ST.pvs)} Trechos:{len(ST.trechos)} Ext:{sum(t.get('ext_m',0) for t in ST.trechos):.0f}m"
        self._ia_call("consultar", q, ctx)
    
    def _ia_resumo(self):
        ctx = f"Núcleo: {ST.nucleo}, {len(ST.pvs)} PVs, {len(ST.trechos)} trechos"
        self._ia_call("resumo_executivo", ctx)
    
    def _ia_hidraulica(self):
        try:
            from motor_parametrico import PipeNetwork
            rede = PipeNetwork(ST.pvs, ST.trechos)
            alertas = rede.trechos_com_alerta()
            self._ia_call("validar_hidraulica", alertas[:20])
        except:
            self.text_ia.insert(tk.END, "Carregue uma rede primeiro\n")
    
    def _ia_perdas(self):
        self._ia_call("analisar_perdas_texto", {"nucleo": ST.nucleo, "pvs": len(ST.pvs), "trechos": len(ST.trechos)})
    
    def _ia_ml(self):
        self._ia_call("explicar_ml", {"producao_atual": 366, "meta_2x": 733, "rolling_3": 12.5})
    
    def _ia_foto(self):
        path = filedialog.askopenfilename(filetypes=[("Imagens", "*.jpg *.jpeg *.png")])
        if path:
            self._ia_call("analisar_foto", path)
    
    def _ia_pdf(self):
        path = filedialog.askopenfilename(filetypes=[("PDF", "*.pdf")])
        if path:
            def run():
                try:
                    from motor_llm import ler_pdf
                    data = ler_pdf(path)
                    ST.pvs = data.get("pvs", {})
                    ST.trechos = data.get("trechos", [])
                    self.root.after(0, self._refresh_tables)
                    self.root.after(0, self._update_stats)
                    self.root.after(0, lambda: self.text_ia.insert(tk.END, f"✅ {len(ST.pvs)} PVs + {len(ST.trechos)} trechos extraídos do PDF\n"))
                except Exception as e:
                    self.root.after(0, lambda: self.text_ia.insert(tk.END, f"❌ {e}\n"))
            self._run_async(run)
    
    # Batch
    def _batch_nucleos(self): self.log("Batch núcleos DXF — selecione pasta com DXFs")
    def _batch_prolongamentos(self): self.log("Batch prolongamentos — selecione pasta com XMLs")
    def _batch_tudo(self): self.log("Batch tudo — roda DXFs + XMLs")


# ══════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════
if __name__ == "__main__":
    root = tk.Tk()
    app = ConstruDataApp(root)
    root.mainloop()
