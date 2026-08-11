import os
import sys
import subprocess
import threading
from pathlib import Path
import customtkinter as ctk
from tkinter import filedialog
from tkintermapview import TkinterMapView

# ─────────────────────────────────────────────────────────
# CONFIGURAÇÕES E ESTILOS
# ─────────────────────────────────────────────────────────
ctk.set_appearance_mode("Dark")  # Forçar Dark Mode
ctk.set_default_color_theme("dark-blue")

# Cores de ConstruData
BG_COLOR = "#0a0a1a"
CARD_COLOR = "#121226"
ACCENT_GREEN = "#00ff88"
ACCENT_BLUE = "#0ea5e9"
TEXT_COLOR = "#f1f5f9"
MUTED_COLOR = "#94a3b8"

class ConstruDataMaxApp(ctk.CTk):
    def __init__(self):
        super().__init__()
        
        self.title("ConstruData Max V2 — HydroNetwork Engine")
        self.geometry("1400x900")
        self.minsize(1000, 700)
        self.configure(fg_color=BG_COLOR)
        
        # Grid Principal
        self.grid_rowconfigure(0, weight=1)
        self.grid_columnconfigure(1, weight=1)
        
        # Variáveis de Estado
        self.dxf_path = ctk.StringVar(value="Selecione o arquivo DXF/DWG/XML...")
        self.out_dir = ctk.StringVar(value=str(Path.home() / "Desktop" / "SAIDA_NS_V5"))
        self.is_running = False
        
        # 1. Sidebar (Esquerda)
        self.build_sidebar()
        
        # 2. Main Content (Direita)
        self.build_main_content()
        
    def build_sidebar(self):
        self.sidebar = ctk.CTkFrame(self, width=250, corner_radius=0, fg_color=CARD_COLOR)
        self.sidebar.grid(row=0, column=0, sticky="nsew")
        self.sidebar.grid_rowconfigure(4, weight=1)
        
        # Logo / Marca
        self.logo_label = ctk.CTkLabel(self.sidebar, text="CONSTRUDATA", font=ctk.CTkFont(size=22, weight="bold"), text_color=ACCENT_GREEN)
        self.logo_label.grid(row=0, column=0, padx=20, pady=(30, 0), sticky="w")
        
        self.sublogo_label = ctk.CTkLabel(self.sidebar, text="HydroNetwork v5", font=ctk.CTkFont(size=13), text_color=ACCENT_BLUE)
        self.sublogo_label.grid(row=1, column=0, padx=20, pady=(0, 30), sticky="w")
        
        # Botões de Navegação
        self.btn_pipeline = ctk.CTkButton(self.sidebar, text="🚀 Pipeline NS", fg_color="transparent", 
                                          text_color=TEXT_COLOR, hover_color="#1e1e38", anchor="w",
                                          font=ctk.CTkFont(size=14, weight="bold"), command=lambda: self.switch_tab("pipeline"))
        self.btn_pipeline.grid(row=2, column=0, padx=10, pady=5, sticky="ew")
        
        self.btn_mapa = ctk.CTkButton(self.sidebar, text="🗺️ Visualizador GIS", fg_color="transparent", 
                                          text_color=TEXT_COLOR, hover_color="#1e1e38", anchor="w",
                                          font=ctk.CTkFont(size=14, weight="bold"), command=lambda: self.switch_tab("mapa"))
        self.btn_mapa.grid(row=3, column=0, padx=10, pady=5, sticky="ew")
        
        # Footer
        self.status_label = ctk.CTkLabel(self.sidebar, text="Status: Aguardando...", text_color=MUTED_COLOR, anchor="w")
        self.status_label.grid(row=5, column=0, padx=20, pady=20, sticky="ew")

    def build_main_content(self):
        self.main_container = ctk.CTkFrame(self, fg_color=BG_COLOR, corner_radius=0)
        self.main_container.grid(row=0, column=1, sticky="nsew", padx=20, pady=20)
        self.main_container.grid_rowconfigure(0, weight=1)
        self.main_container.grid_columnconfigure(0, weight=1)
        
        # --- TAB: PIPELINE ---
        self.tab_pipeline = ctk.CTkFrame(self.main_container, fg_color="transparent")
        self.tab_pipeline.grid_rowconfigure(2, weight=1)
        self.tab_pipeline.grid_columnconfigure(0, weight=1)
        
        # Header pipeline
        lbl_header = ctk.CTkLabel(self.tab_pipeline, text="Pipeline de Geração de Notas de Serviço", 
                                  font=ctk.CTkFont(size=24, weight="bold"), text_color=TEXT_COLOR, anchor="w")
        lbl_header.grid(row=0, column=0, pady=(0, 20), sticky="w")
        
        # Card Arquivo
        card_arquivo = ctk.CTkFrame(self.tab_pipeline, fg_color=CARD_COLOR, corner_radius=12)
        card_arquivo.grid(row=1, column=0, sticky="ew", pady=(0, 20))
        card_arquivo.grid_columnconfigure(1, weight=1)
        
        ctk.CTkLabel(card_arquivo, text="1. Selecione o Projeto (DXF/DWG)", font=ctk.CTkFont(size=14, weight="bold")).grid(row=0, column=0, padx=20, pady=15, sticky="w")
        
        self.entry_dxf = ctk.CTkEntry(card_arquivo, textvariable=self.dxf_path, fg_color="#1a1a36", border_width=1, border_color="#2d2d50")
        self.entry_dxf.grid(row=1, column=0, columnspan=2, padx=20, pady=(0, 5), sticky="ew")
        
        btn_browse = ctk.CTkButton(card_arquivo, text="Procurar...", fg_color="#2563eb", hover_color="#1d4ed8", width=120, command=self.browse_file)
        btn_browse.grid(row=1, column=2, padx=20, pady=(0, 5))
        
        ctk.CTkLabel(card_arquivo, text="Pasta de Saída:", font=ctk.CTkFont(size=12), text_color=MUTED_COLOR).grid(row=2, column=0, padx=20, pady=(5,0), sticky="w")
        self.entry_out = ctk.CTkEntry(card_arquivo, textvariable=self.out_dir, fg_color="#1a1a36", border_width=1, border_color="#2d2d50")
        self.entry_out.grid(row=3, column=0, columnspan=2, padx=20, pady=(0, 15), sticky="ew")
        
        btn_out_browse = ctk.CTkButton(card_arquivo, text="Alterar...", fg_color="transparent", border_width=1, border_color=MUTED_COLOR, width=120, command=self.browse_out)
        btn_out_browse.grid(row=3, column=2, padx=20, pady=(0, 15))

        # Card Ações
        card_acoes = ctk.CTkFrame(self.tab_pipeline, fg_color=CARD_COLOR, corner_radius=12)
        card_acoes.grid(row=2, column=0, sticky="nsew")
        card_acoes.grid_columnconfigure(0, weight=1)
        card_acoes.grid_rowconfigure(2, weight=1)
        
        ctk.CTkLabel(card_acoes, text="2. Processamento (Motores: GDAL, Dynamo, ML)", font=ctk.CTkFont(size=14, weight="bold")).grid(row=0, column=0, padx=20, pady=15, sticky="w")
        
        buttons_frame = ctk.CTkFrame(card_acoes, fg_color="transparent")
        buttons_frame.grid(row=1, column=0, padx=20, sticky="ew")
        buttons_frame.grid_columnconfigure((0,1,2,3), weight=1)
        
        self.btn_run = ctk.CTkButton(buttons_frame, text="✅ GERAR NOTAS (Auto)", fg_color="#059669", hover_color="#047857", font=ctk.CTkFont(size=14, weight="bold"), height=40, command=self.run_pipeline)
        self.btn_run.grid(row=0, column=0, padx=5, sticky="ew")
        
        self.btn_run_conservador = ctk.CTkButton(buttons_frame, text="🛡️ MODO CONSERVADOR", fg_color="#ca8a04", hover_color="#a16207", font=ctk.CTkFont(size=14, weight="bold"), height=40, command=self.run_pipeline_conservador)
        self.btn_run_conservador.grid(row=0, column=1, padx=5, sticky="ew")

        # Chama interface clássica se o cara não quiser ficar só nessa
        self.btn_gui_classica = ctk.CTkButton(buttons_frame, text="⏪ GUI CLÁSSICA", fg_color="#6366f1", hover_color="#4f46e5", font=ctk.CTkFont(size=14, weight="bold"), height=40, command=self.run_classic_gui)
        self.btn_gui_classica.grid(row=0, column=2, padx=5, sticky="ew")
        
        self.btn_open_folder = ctk.CTkButton(buttons_frame, text="📂 ABRIR RESULTADOS", fg_color="#334155", hover_color="#475569", font=ctk.CTkFont(size=14, weight="bold"), height=40, command=self.open_output_folder)
        self.btn_open_folder.grid(row=0, column=3, padx=5, sticky="ew")
        
        # Terminal Log
        self.textbox_log = ctk.CTkTextbox(card_acoes, fg_color="#000000", text_color="#10b981", font=ctk.CTkFont(family="Consolas", size=13))
        self.textbox_log.grid(row=2, column=0, padx=20, pady=(20, 20), sticky="nsew")
        self.textbox_log.insert("0.0", "ConstruData Max V2 - Console Iniciado.\nAguardando projeto...\n\n")
        self.textbox_log.configure(state="disabled")

        # --- TAB: MAPA ---
        self.tab_mapa = ctk.CTkFrame(self.main_container, fg_color="transparent")
        self.tab_mapa.grid_rowconfigure(1, weight=1)
        self.tab_mapa.grid_columnconfigure(0, weight=1)
        
        lbl_mapa = ctk.CTkLabel(self.tab_mapa, text="Visualizador de Infraestrutura", 
                                  font=ctk.CTkFont(size=24, weight="bold"), text_color=TEXT_COLOR, anchor="w")
        lbl_mapa.grid(row=0, column=0, pady=(0, 20), sticky="w")
        
        mapa_card = ctk.CTkFrame(self.tab_mapa, fg_color=CARD_COLOR, corner_radius=12)
        mapa_card.grid(row=1, column=0, sticky="nsew")
        mapa_card.grid_columnconfigure(0, weight=1)
        mapa_card.grid_rowconfigure(0, weight=1)
        
        try:
            self.map_widget = TkinterMapView(mapa_card, corner_radius=10)
            self.map_widget.grid(row=0, column=0, padx=10, pady=10, sticky="nsew")
            self.map_widget.set_position(-23.9535, -46.3333) # Coordenadas padrão Santos
            self.map_widget.set_zoom(13)
            self.map_widget.set_tile_server("https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}", max_zoom=20)
        except Exception:
            ctk.CTkLabel(mapa_card, text="Módulo de mapa não carregado. TkinterMapView ou conexão falhou.").grid(row=0, column=0)

        # Inicia mostrando pipeline
        self.switch_tab("pipeline")

    def switch_tab(self, tab):
        self.tab_pipeline.grid_remove()
        self.tab_mapa.grid_remove()
        
        self.btn_pipeline.configure(fg_color="transparent")
        self.btn_mapa.configure(fg_color="transparent")
        
        if tab == "pipeline":
            self.tab_pipeline.grid(row=0, column=0, sticky="nsew")
            self.btn_pipeline.configure(fg_color="#1e1e38")
        elif tab == "mapa":
            self.tab_mapa.grid(row=0, column=0, sticky="nsew")
            self.btn_mapa.configure(fg_color="#1e1e38")

    def browse_file(self):
        filepath = filedialog.askopenfilename(
            title="Selecionar Projeto",
            filetypes=[("Projetos suportados", "*.dxf *.dwg *.xml *.json"), ("All Files", "*.*")]
        )
        if filepath:
            self.dxf_path.set(filepath)
            
    def browse_out(self):
        folder = filedialog.askdirectory(title="Pasta de Saída")
        if folder:
            self.out_dir.set(folder)
            
    def open_output_folder(self):
        out = self.out_dir.get()
        if os.path.exists(out):
            os.startfile(out)
            
    def append_log(self, text):
        self.textbox_log.configure(state="normal")
        self.textbox_log.insert("end", text)
        self.textbox_log.see("end")
        self.textbox_log.configure(state="disabled")

    def run_classic_gui(self):
        """Abre a interface antiga por segurança se o usuário precisar de uma aba específica."""
        threading.Thread(target=self._run_classic_process, daemon=True).start()

    def _run_classic_process(self):
        script_path = Path(__file__).parent / "construdata_gui.py"
        subprocess.Popen([sys.executable, str(script_path)], creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)

    def run_pipeline(self):
        if self.is_running:
            return
        
        file = self.dxf_path.get()
        if not os.path.exists(file):
            self.append_log(f"\n[ERRO] Arquivo não encontrado: {file}\n")
            return
            
        self.is_running = True
        self.status_label.configure(text="Status: Processando Rede...", text_color=ACCENT_GREEN)
        self.btn_run.configure(state="disabled", fg_color="#1e293b", text="⏳ GERANDO...")
        
        # Roda em thread separada para não travar a GUI
        threading.Thread(target=self._run_process, args=(file, self.out_dir.get(), "normal"), daemon=True).start()
        
    def run_pipeline_conservador(self):
        if self.is_running:
            return
        
        file = self.dxf_path.get()
        if not os.path.exists(file):
            self.append_log(f"\n[ERRO] Arquivo não encontrado: {file}\n")
            return
            
        self.is_running = True
        self.status_label.configure(text="Status: Processando Rede (Conservador)...", text_color="#ca8a04")
        self.btn_run_conservador.configure(state="disabled", fg_color="#a16207", text="⏳ PROCESSANDO...")
        
        threading.Thread(target=self._run_process, args=(file, self.out_dir.get(), "conservador"), daemon=True).start()

    def _run_process(self, filepath, outdir, modo):
        script_path = Path(__file__).parent / "gerar_ns_v4.py"
        
        if not script_path.exists():
            self.append_log(f"\n[ERRO FATAL] Script não encontrado: {script_path}\n")
            self._reset_run_state()
            return
            
        self.append_log(f"\n{'-'*60}\n")
        self.append_log(f"Iniciando Motor ConstruData v5 ({modo})\n")
        self.append_log(f"Projeto: {filepath}\n")
        self.append_log(f"{'-'*60}\n")
        
        cmd = [sys.executable, str(script_path), filepath, outdir]
        
        try:
            # Subprocess com captura de streaming realtime!
            self.process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                encoding="utf-8",
                errors="replace",
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
            )

            for line in self.process.stdout:
                self.after(0, self.append_log, line)

            self.process.wait()
            
            if self.process.returncode == 0:
                self.after(0, self.append_log, f"\n[SUCESSO] Processamento finalizado! ({self.process.returncode})\n")
                self.after(0, self.status_label.configure, {"text": "Status: Concluído com Sucesso!", "text_color": "#3b82f6"})
            else:
                self.after(0, self.append_log, f"\n[AVISO] Processo terminou com código ou warning ({self.process.returncode})\n")
                self.after(0, self.status_label.configure, {"text": "Status: Finalizado (com avisos)", "text_color": "#eab308"})

        except Exception as e:
            self.after(0, self.append_log, f"\n[ERRO DE EXECUÇÃO] {str(e)}\n")
            self.after(0, self.status_label.configure, {"text": "Status: Falha de Execução", "text_color": "#ef4444"})
            
        finally:
            self._reset_run_state()

    def _reset_run_state(self):
        self.is_running = False
        self.after(0, self.btn_run.configure, {"state": "normal", "fg_color": "#059669", "text": "✅ GERAR NOTAS (Auto)"})
        self.after(0, self.btn_run_conservador.configure, {"state": "normal", "fg_color": "#ca8a04", "text": "🛡️ MODO CONSERVADOR"})

if __name__ == "__main__":
    app = ConstruDataMaxApp()
    app.mainloop()
