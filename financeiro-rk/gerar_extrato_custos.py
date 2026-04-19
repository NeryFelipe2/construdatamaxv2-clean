import pandas as pd
import os

# Dados das medições
dados_medicao = [
    {"Obra": "CONSÓRCIO CGMT TATUI", "Valor (R$)": 744748.94},
    {"Obra": "CONSÓRCIO CSU OSASCO", "Valor (R$)": 275000.00},
    {"Obra": "CONSÓRCIO SLNR SANTOS", "Valor (R$)": 300000.00},
    {"Obra": "TOTAL", "Valor (R$)": 1319748.94}
]

df_medicao = pd.DataFrame(dados_medicao)

# Dados dos Custos
dados_custos = [
    {"Consórcio / Obra": "CONSÓRCIO CGMT TATUI", "Item": "Folha de Pagamentos", "Valor (R$)": 79977.88},
    {"Consórcio / Obra": "CONSÓRCIO CGMT TATUI", "Item": "Folha Eng", "Valor (R$)": 10000.00},
    {"Consórcio / Obra": "CONSÓRCIO CGMT TATUI", "Item": "Alojamento mod", "Valor (R$)": 3050.00},
    {"Consórcio / Obra": "CONSÓRCIO CGMT TATUI", "Item": "Água", "Valor (R$)": 300.00},
    {"Consórcio / Obra": "CONSÓRCIO CGMT TATUI", "Item": "Luz", "Valor (R$)": 300.00},
    {"Consórcio / Obra": "CONSÓRCIO CGMT TATUI", "Item": "Alojamento Eng", "Valor (R$)": 2500.00},
    {"Consórcio / Obra": "CONSÓRCIO CGMT TATUI", "Item": "Água", "Valor (R$)": 150.00},
    {"Consórcio / Obra": "CONSÓRCIO CGMT TATUI", "Item": "Luz", "Valor (R$)": 150.00},
    {"Consórcio / Obra": "CONSÓRCIO CGMT TATUI", "Item": "Carro Eng", "Valor (R$)": 3200.00},
    {"Consórcio / Obra": "CONSÓRCIO CGMT TATUI", "Item": "Alimentação", "Valor (R$)": 39600.00},
    {"Consórcio / Obra": "CONSÓRCIO CGMT TATUI", "Item": "Combustível", "Valor (R$)": 3000.00},
    {"Consórcio / Obra": "CONSÓRCIO CGMT TATUI", "Item": "Baixada", "Valor (R$)": 2399.34},
    {"Consórcio / Obra": "CONSÓRCIO CGMT TATUI", "Item": "Ferramentas", "Valor (R$)": 1500.00},
    {"Consórcio / Obra": "CONSÓRCIO CGMT TATUI", "Item": "SUBTOTAL TATUI", "Valor (R$)": 146127.22},

    {"Consórcio / Obra": "CONSÓRCIO CSU OSASCO", "Item": "Folha de Pagamentos", "Valor (R$)": 32074.19},
    {"Consórcio / Obra": "CONSÓRCIO CSU OSASCO", "Item": "Folha Eng", "Valor (R$)": 10000.00},
    {"Consórcio / Obra": "CONSÓRCIO CSU OSASCO", "Item": "Alojamento mod", "Valor (R$)": 6500.00},
    {"Consórcio / Obra": "CONSÓRCIO CSU OSASCO", "Item": "Água", "Valor (R$)": 300.00},
    {"Consórcio / Obra": "CONSÓRCIO CSU OSASCO", "Item": "Luz", "Valor (R$)": 300.00},
    {"Consórcio / Obra": "CONSÓRCIO CSU OSASCO", "Item": "Alojamento Eng", "Valor (R$)": 2400.00},
    {"Consórcio / Obra": "CONSÓRCIO CSU OSASCO", "Item": "Água", "Valor (R$)": 150.00},
    {"Consórcio / Obra": "CONSÓRCIO CSU OSASCO", "Item": "Luz", "Valor (R$)": 150.00},
    {"Consórcio / Obra": "CONSÓRCIO CSU OSASCO", "Item": "Carro Eng", "Valor (R$)": 3350.00},
    {"Consórcio / Obra": "CONSÓRCIO CSU OSASCO", "Item": "Carro Enc", "Valor (R$)": 3550.00},
    {"Consórcio / Obra": "CONSÓRCIO CSU OSASCO", "Item": "Alimentação", "Valor (R$)": 10560.00},
    {"Consórcio / Obra": "CONSÓRCIO CSU OSASCO", "Item": "Combustível", "Valor (R$)": 6000.00},
    {"Consórcio / Obra": "CONSÓRCIO CSU OSASCO", "Item": "Baixada", "Valor (R$)": 962.23},
    {"Consórcio / Obra": "CONSÓRCIO CSU OSASCO", "Item": "Ferramentas", "Valor (R$)": 1500.00},
    {"Consórcio / Obra": "CONSÓRCIO CSU OSASCO", "Item": "SUBTOTAL OSASCO", "Valor (R$)": 77796.42},

    {"Consórcio / Obra": "CONSÓRCIO SLNR SANTOS", "Item": "Alojamento mod", "Valor (R$)": 3300.00},
    {"Consórcio / Obra": "CONSÓRCIO SLNR SANTOS", "Item": "Água", "Valor (R$)": 150.00},
    {"Consórcio / Obra": "CONSÓRCIO SLNR SANTOS", "Item": "Luz", "Valor (R$)": 150.00},
    {"Consórcio / Obra": "CONSÓRCIO SLNR SANTOS", "Item": "Alojamento Eng", "Valor (R$)": 3950.00},
    {"Consórcio / Obra": "CONSÓRCIO SLNR SANTOS", "Item": "Água", "Valor (R$)": 150.00},
    {"Consórcio / Obra": "CONSÓRCIO SLNR SANTOS", "Item": "Luz", "Valor (R$)": 150.00},
    {"Consórcio / Obra": "CONSÓRCIO SLNR SANTOS", "Item": "Alojamento Enc", "Valor (R$)": 4000.00},
    {"Consórcio / Obra": "CONSÓRCIO SLNR SANTOS", "Item": "Água", "Valor (R$)": 150.00},
    {"Consórcio / Obra": "CONSÓRCIO SLNR SANTOS", "Item": "Luz", "Valor (R$)": 150.00},
    {"Consórcio / Obra": "CONSÓRCIO SLNR SANTOS", "Item": "Aluguel Escritório", "Valor (R$)": 1000.00},
    {"Consórcio / Obra": "CONSÓRCIO SLNR SANTOS", "Item": "Água", "Valor (R$)": 150.00},
    {"Consórcio / Obra": "CONSÓRCIO SLNR SANTOS", "Item": "Luz", "Valor (R$)": 150.00},
    {"Consórcio / Obra": "CONSÓRCIO SLNR SANTOS", "Item": "Loja Tetéu", "Valor (R$)": 5000.00},
    {"Consórcio / Obra": "CONSÓRCIO SLNR SANTOS", "Item": "Locação EQD", "Valor (R$)": 8000.00},
    {"Consórcio / Obra": "CONSÓRCIO SLNR SANTOS", "Item": "Baixada", "Valor (R$)": 2500.00},
    {"Consórcio / Obra": "CONSÓRCIO SLNR SANTOS", "Item": "SUBTOTAL SANTOS", "Valor (R$)": 28950.00},
    {"Consórcio / Obra": "TOTAL GERAL", "Item": "-", "Valor (R$)": 252873.64}
]
df_custos = pd.DataFrame(dados_custos)

caminho_saida = r"c:\Users\felip\Desktop\_ORGANIZADO\01-OBRAS-RK\Extrato_Custos_Prontos.xlsx"

try:
    with pd.ExcelWriter(caminho_saida, engine='openpyxl') as writer:
        df_medicao.to_excel(writer, sheet_name='Medicao_Previa', index=False)
        df_custos.to_excel(writer, sheet_name='Custos_Consolidados', index=False)
    print(f"✅ Arquivo {caminho_saida} gerado com sucesso! Você pode copiar os dados de lá para o fluxo de caixa/dashboard consolidado.")
except Exception as e:
    print(f"Erro ao salvar: {e}")
