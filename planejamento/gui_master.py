"""Botão standalone (tkinter) para gerar a planilha-mestre — NÃO mexe no GUI
legado (construdata_gui.py). Toda a lógica fica em cli.gerar_de_dxf (testada);
aqui é só a janelinha de seleção de arquivos.
"""


def construir_app():
    import tkinter as tk
    from tkinter import filedialog, messagebox
    from .cli import gerar_de_dxf
    from .leitor_rede import RedeNaoEncontrada

    root = tk.Tk()
    root.title("Planejamento — Gerar Planilha-Mestre")
    estado = {"esgoto": tk.StringVar(), "agua": tk.StringVar(),
              "layers_esg": tk.StringVar(), "saida": tk.StringVar()}

    def escolher(var, salvar=False):
        if salvar:
            p = filedialog.asksaveasfilename(defaultextension=".xlsx",
                                             filetypes=[("Excel", "*.xlsx")])
        else:
            p = filedialog.askopenfilename(filetypes=[("DXF", "*.dxf"), ("Todos", "*.*")])
        if p:
            var.set(p)

    def gerar():
        layers = estado["layers_esg"].get().split() or None
        try:
            info = gerar_de_dxf(estado["saida"].get() or "PLANEJAMENTO_MASTER.xlsx",
                                dxf_esgoto=estado["esgoto"].get() or None,
                                dxf_agua=estado["agua"].get() or None,
                                layers_esgoto=layers)
            messagebox.showinfo("OK", "Gerado:\n%s\n\nAbas: %s"
                                % (info["saida"], ", ".join(info["abas"])))
        except RedeNaoEncontrada as e:
            messagebox.showwarning("Leitura não confiável",
                                   "%s\n\nPreencha 'Layers esgoto' (ex.: 0) e tente de novo." % e)
        except Exception as e:                                    # noqa: BLE001
            messagebox.showerror("Erro", str(e))

    linhas = [("DXF esgoto:", "esgoto", False), ("DXF água:", "agua", False),
              ("Layers esgoto (opcional, ex.: 0):", "layers_esg", None),
              ("Salvar como:", "saida", True)]
    for i, (rotulo, chave, modo) in enumerate(linhas):
        tk.Label(root, text=rotulo).grid(row=i, column=0, sticky="e", padx=4, pady=3)
        tk.Entry(root, textvariable=estado[chave], width=48).grid(row=i, column=1, padx=4)
        if modo is not None:
            tk.Button(root, text="...",
                      command=lambda v=estado[chave], s=modo: escolher(v, s)).grid(row=i, column=2)
    tk.Button(root, text="Gerar planilha-mestre", command=gerar).grid(
        row=len(linhas), column=1, pady=8)
    return root


def main():
    construir_app().mainloop()


if __name__ == "__main__":
    main()
