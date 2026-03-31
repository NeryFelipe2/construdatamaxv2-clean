import os
import shutil
import textwrap

DEST_ROOT = r"C:\Users\felip\Downloads\construdatamaxv2-clean"
PUBLIC_DIR = os.path.join(DEST_ROOT, "frontend", "public", "offline_modules")
DATA_DIR = os.path.join(DEST_ROOT, "dados_estaticos")

os.makedirs(PUBLIC_DIR, exist_ok=True)
os.makedirs(DATA_DIR, exist_ok=True)

try:
    # 1. Copiar Painel Offline Construplan
    src_construplan = r"C:\Users\felip\Downloads\NOVOS NUCLEOS PLANEJAMENTO\Santos_SABESP\Santos_SABESP\Construplan\construplan_brutal.html"
    if os.path.exists(src_construplan):
        shutil.copy2(src_construplan, os.path.join(PUBLIC_DIR, "construplan.html"))
        print("✓ Copiado construplan_brutal.html -> public/offline_modules/construplan.html")

    # 2. Copiar Painel DashCenarios
    src_cenarios = r"C:\Users\felip\Downloads\NOVA NS Versao 5\DASHBOARD_CENARIOS.html"
    if os.path.exists(src_cenarios):
        shutil.copy2(src_cenarios, os.path.join(PUBLIC_DIR, "cenarios.html"))
        print("✓ Copiado DASHBOARD_CENARIOS.html -> public/offline_modules/cenarios.html")

    # 3. Copiar SAIDA_PROSANE (Relatórios)
    src_prosane = r"C:\Users\felip\Downloads\PROJETOS DE ÁGUA E ESGOTO - DWG E DXF 2018\MAPAS ÁGUA E ESGOTO PARA DXF\VILA DOS CRIADORES\SAIDA_PROSANE"
    dst_prosane = os.path.join(DATA_DIR, "SAIDA_PROSANE")
    if os.path.exists(src_prosane):
        if os.path.exists(dst_prosane):
            shutil.rmtree(dst_prosane)
        shutil.copytree(src_prosane, dst_prosane)
        print("✓ Copiada inteira a pasta SAIDA_PROSANE -> /dados_estaticos/SAIDA_PROSANE")

    # 4. Copiar Planilha Excel
    src_xls = r"C:\Users\felip\Downloads\ConstruData_HydroNetwork_V4_FINAL_1\PACOTE_V4\exemplos\XLSX\MICROPLAN_Verde_e_Teteu.xlsx"
    if os.path.exists(src_xls):
        shutil.copy2(src_xls, os.path.join(DATA_DIR, "MICROPLAN_Verde_e_Teteu.xlsx"))
        print("✓ Copiada planilha MICROPLAN_Verde_e_Teteu.xlsx -> /dados_estaticos/MICROPLAN_Verde_e_Teteu.xlsx")
        
    # 5. Bring construplan_backend.py into API
    src_backend = r"C:\Users\felip\Downloads\NOVOS NUCLEOS PLANEJAMENTO\Santos_SABESP\Santos_SABESP\Construplan\construplan_backend.py"
    dst_backend = os.path.join(DEST_ROOT, "api", "construplan_flask_backend.py")
    if os.path.exists(src_backend):
        shutil.copy2(src_backend, dst_backend)
        print("✓ Backend flask (1500 linhas) copiado -> api/construplan_flask_backend.py")

except Exception as e:
    print(f"Erro na cópia: {e}")
