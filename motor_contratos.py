#!/usr/bin/env python3
"""
MOTOR_CONTRATOS.PY — Gestor Multi-Contrato
ConstruData - HydroNetwork · FCN Construções e Saneamento

A plataforma NÃO é só pra Santos. NÃO é só SE LIGA NA REDE.
Qualquer contrato de saneamento (água + esgoto) em qualquer cidade.

ESTRUTURA:
  ~/.construdata/
    contratos/
      slnr_santos/           ← CT 11481051
        contrato.json         ← dados do contrato
        precos.json           ← tabela de preços
        nucleos/              ← núcleos deste contrato
          verde_teteu/
            rede.json         ← pvs + trechos
            ns/               ← notas de serviço geradas
            ifc/              ← modelos IFC
          pantanal/
            ...
      outro_contrato/         ← Novo contrato qualquer
        contrato.json
        precos.json
        nucleos/
          ...
    config.json               ← configuração global (LLM keys, etc)
    contrato_ativo.json       ← qual contrato está selecionado

FUNCIONALIDADES:
  - Criar contrato novo (qualquer cidade, qualquer contratante)
  - Editar dados do contrato (nome, empresa, custos, BDI)
  - Trocar contrato ativo
  - Importar tabela de preços por contrato
  - Cada contrato tem seus próprios núcleos, preços, configurações
  - Listar todos os contratos
  - Exportar/importar contrato inteiro (portabilidade)
"""

import json, os, shutil
from pathlib import Path
from datetime import datetime


# ══════════════════════════════════════════════════════════
# PATHS
# ══════════════════════════════════════════════════════════

BASE_DIR = Path.home() / ".construdata"
CONTRATOS_DIR = BASE_DIR / "contratos"
CONFIG_PATH = BASE_DIR / "config.json"
ATIVO_PATH = BASE_DIR / "contrato_ativo.json"


def _ensure_dirs():
    BASE_DIR.mkdir(exist_ok=True)
    CONTRATOS_DIR.mkdir(exist_ok=True)


def _slug(nome):
    """Converte nome em slug seguro pra pasta."""
    import re
    s = nome.lower().strip()
    s = re.sub(r'[àáâã]', 'a', s)
    s = re.sub(r'[éêë]', 'e', s)
    s = re.sub(r'[íî]', 'i', s)
    s = re.sub(r'[óôõ]', 'o', s)
    s = re.sub(r'[úû]', 'u', s)
    s = re.sub(r'[ç]', 'c', s)
    s = re.sub(r'[^a-z0-9]+', '_', s)
    return s.strip('_')


# ══════════════════════════════════════════════════════════
# CONTRATO — CRIAR / EDITAR / LISTAR
# ══════════════════════════════════════════════════════════

TEMPLATE_CONTRATO = {
    "nome": "",
    "numero": "",
    "contratante": "",          # SABESP, COPASA, SANEPAR, Prefeitura, etc.
    "empresa": "FCN Construções e Saneamento",
    "cidade": "",
    "estado": "",
    "tipo_obra": "agua_esgoto", # agua_esgoto, agua, esgoto, drenagem
    "descricao": "",
    "data_inicio": "",
    "data_fim_previsto": "",
    "valor_contrato": 0,
    "bdi_pct": 25.0,
    "custo_medio_metro": 910.0,
    "crs": "EPSG:31983",       # Padrão Brasil — ajustar por região
    "utm_zone": "23S",
    "centro_lat": -23.96,      # Centro do mapa quando abrir
    "centro_lng": -46.33,
    "zoom_inicial": 14,
    "manning_n": {"PVC": 0.013, "PEAD": 0.011, "PE 80": 0.011, "PE 100": 0.011, "CONCRETO": 0.015},
    "dns_esgoto": [100, 150, 200, 250, 300, 400, 500, 600],
    "dns_agua": [32, 50, 63, 75, 110, 160, 200, 250, 315],
    "materiais_esgoto": ["PVC", "CONCRETO"],
    "materiais_agua": ["PEAD", "PE 80", "PE 100", "PVC"],
    "nucleos": [],
    "criado_em": "",
    "atualizado_em": "",
}

TEMPLATE_PRECOS = {
    "composicao_metro": {
        "escavacao": 145, "tubo_esg": 240, "tubo_ag": 95,
        "pv_caixas": 120, "reaterro": 80, "ramal": 65,
        "pavimentacao": 45, "sinalizacao": 15,
    },
    "materiais": {
        "Tubo PVC DN200": {"tipo": "ESG", "un": "m", "preco": 200.12},
        "Tubo PVC DN300": {"tipo": "ESG", "un": "m", "preco": 310.00},
        "PV concreto DN1200": {"tipo": "ESG", "un": "un", "preco": 3686.00},
        "PI plástico DN600": {"tipo": "ESG", "un": "un", "preco": 1412.00},
        "Tubo PEAD DN63": {"tipo": "AG", "un": "m", "preco": 85.00},
        "Tubo PEAD DN110": {"tipo": "AG", "un": "m", "preco": 101.80},
        "Areia": {"tipo": "GERAL", "un": "m³", "preco": 160.00},
        "CBUQ definitivo": {"tipo": "GERAL", "un": "m²", "preco": 120.00},
    },
    "fonte": "SINAPI + Contrato",
    "data_ref": "",
}

# CRS por estado (UTM zones mais comuns no Brasil)
CRS_BRASIL = {
    "SP": {"crs": "EPSG:31983", "zone": "23S", "lat": -23.5, "lng": -46.6},
    "RJ": {"crs": "EPSG:31983", "zone": "23S", "lat": -22.9, "lng": -43.2},
    "MG": {"crs": "EPSG:31983", "zone": "23S", "lat": -19.9, "lng": -43.9},
    "PR": {"crs": "EPSG:31982", "zone": "22S", "lat": -25.4, "lng": -49.3},
    "SC": {"crs": "EPSG:31982", "zone": "22S", "lat": -27.6, "lng": -48.5},
    "RS": {"crs": "EPSG:31982", "zone": "22S", "lat": -30.0, "lng": -51.2},
    "BA": {"crs": "EPSG:31984", "zone": "24S", "lat": -12.9, "lng": -38.5},
    "PE": {"crs": "EPSG:31985", "zone": "25S", "lat": -8.05, "lng": -34.9},
    "CE": {"crs": "EPSG:31984", "zone": "24S", "lat": -3.7, "lng": -38.5},
    "PA": {"crs": "EPSG:31982", "zone": "22S", "lat": -1.4, "lng": -48.5},
    "AM": {"crs": "EPSG:31980", "zone": "20S", "lat": -3.1, "lng": -60.0},
    "GO": {"crs": "EPSG:31982", "zone": "22S", "lat": -16.7, "lng": -49.3},
    "DF": {"crs": "EPSG:31983", "zone": "23S", "lat": -15.8, "lng": -47.9},
    "MT": {"crs": "EPSG:31981", "zone": "21S", "lat": -15.6, "lng": -56.1},
    "MS": {"crs": "EPSG:31981", "zone": "21S", "lat": -20.4, "lng": -54.6},
    "ES": {"crs": "EPSG:31984", "zone": "24S", "lat": -20.3, "lng": -40.3},
    "MA": {"crs": "EPSG:31983", "zone": "23S", "lat": -2.5, "lng": -44.3},
    "PI": {"crs": "EPSG:31983", "zone": "23S", "lat": -5.1, "lng": -42.8},
}


def criar_contrato(nome, numero="", contratante="", cidade="", estado="SP",
                   tipo_obra="agua_esgoto", empresa="FCN Construções e Saneamento",
                   bdi=25.0, custo_metro=910.0, valor_contrato=0):
    """
    Cria um novo contrato.
    
    Returns:
        dict com dados do contrato criado
    """
    _ensure_dirs()
    
    slug = _slug(f"{numero}_{nome}" if numero else nome)
    contrato_dir = CONTRATOS_DIR / slug
    
    if contrato_dir.exists():
        raise FileExistsError(f"Contrato '{slug}' já existe em {contrato_dir}")
    
    contrato_dir.mkdir(parents=True)
    (contrato_dir / "nucleos").mkdir()
    
    # CRS automático por estado
    crs_info = CRS_BRASIL.get(estado.upper(), CRS_BRASIL["SP"])
    
    contrato = dict(TEMPLATE_CONTRATO)
    contrato.update({
        "nome": nome,
        "numero": numero,
        "contratante": contratante,
        "empresa": empresa,
        "cidade": cidade,
        "estado": estado.upper(),
        "tipo_obra": tipo_obra,
        "bdi_pct": bdi,
        "custo_medio_metro": custo_metro,
        "valor_contrato": valor_contrato,
        "crs": crs_info["crs"],
        "utm_zone": crs_info["zone"],
        "centro_lat": crs_info["lat"],
        "centro_lng": crs_info["lng"],
        "criado_em": datetime.now().isoformat(),
        "atualizado_em": datetime.now().isoformat(),
    })
    
    # Salvar
    (contrato_dir / "contrato.json").write_text(json.dumps(contrato, indent=2, ensure_ascii=False))
    (contrato_dir / "precos.json").write_text(json.dumps(TEMPLATE_PRECOS, indent=2, ensure_ascii=False))
    
    # Ativar automaticamente
    ativar_contrato(slug)
    
    return contrato


def editar_contrato(slug, **campos):
    """Edita campos de um contrato existente."""
    path = CONTRATOS_DIR / slug / "contrato.json"
    if not path.exists():
        raise FileNotFoundError(f"Contrato '{slug}' não encontrado")
    
    contrato = json.loads(path.read_text())
    contrato.update(campos)
    contrato["atualizado_em"] = datetime.now().isoformat()
    
    # Se mudou estado, atualizar CRS
    if "estado" in campos:
        crs_info = CRS_BRASIL.get(campos["estado"].upper(), CRS_BRASIL["SP"])
        contrato["crs"] = crs_info["crs"]
        contrato["utm_zone"] = crs_info["zone"]
        if "centro_lat" not in campos:
            contrato["centro_lat"] = crs_info["lat"]
            contrato["centro_lng"] = crs_info["lng"]
    
    path.write_text(json.dumps(contrato, indent=2, ensure_ascii=False))
    return contrato


def listar_contratos():
    """Lista todos os contratos."""
    _ensure_dirs()
    contratos = []
    ativo = get_contrato_ativo_slug()
    
    for d in sorted(CONTRATOS_DIR.iterdir()):
        if d.is_dir() and (d / "contrato.json").exists():
            c = json.loads((d / "contrato.json").read_text())
            n_nucleos = len(list((d / "nucleos").iterdir())) if (d / "nucleos").exists() else 0
            contratos.append({
                "slug": d.name,
                "nome": c.get("nome", ""),
                "numero": c.get("numero", ""),
                "contratante": c.get("contratante", ""),
                "cidade": c.get("cidade", ""),
                "estado": c.get("estado", ""),
                "n_nucleos": n_nucleos,
                "ativo": d.name == ativo,
            })
    return contratos


def get_contrato(slug=None):
    """Retorna dados do contrato (ativo se slug=None)."""
    slug = slug or get_contrato_ativo_slug()
    if not slug:
        return None
    path = CONTRATOS_DIR / slug / "contrato.json"
    if not path.exists():
        return None
    return json.loads(path.read_text())


def get_precos(slug=None):
    """Retorna tabela de preços do contrato."""
    slug = slug or get_contrato_ativo_slug()
    if not slug:
        return TEMPLATE_PRECOS
    path = CONTRATOS_DIR / slug / "precos.json"
    if not path.exists():
        return TEMPLATE_PRECOS
    return json.loads(path.read_text())


def importar_precos(slug, caminho_csv_ou_json):
    """Importa tabela de preços de CSV ou JSON para o contrato."""
    precos = dict(TEMPLATE_PRECOS)
    
    if caminho_csv_ou_json.endswith('.json'):
        with open(caminho_csv_ou_json) as f:
            data = json.load(f)
            if "materiais" in data:
                precos = data
            elif isinstance(data, list):
                for item in data:
                    nome = item.get("material", item.get("servico", ""))
                    if nome:
                        precos["materiais"][nome] = {
                            "tipo": item.get("tipo", ""),
                            "un": item.get("unidade", item.get("un", "")),
                            "preco": float(item.get("preco", 0)),
                        }
    elif caminho_csv_ou_json.endswith('.csv'):
        import csv
        with open(caminho_csv_ou_json, encoding="utf-8-sig") as f:
            first_line = f.readline()
            sep = ';' if ';' in first_line else ','
            f.seek(0)
            reader = csv.DictReader(f, delimiter=sep)
            for row in reader:
                nome = row.get("material", row.get("servico", row.get("MATERIAL", "")))
                if nome:
                    precos["materiais"][nome] = {
                        "tipo": row.get("tipo", row.get("TIPO", "")),
                        "un": row.get("unidade", row.get("UN", "")),
                        "preco": float(str(row.get("preco", row.get("PREÇO", "0"))).replace(",", ".")),
                    }
    
    precos["data_ref"] = datetime.now().strftime("%b/%Y")
    path = CONTRATOS_DIR / slug / "precos.json"
    path.write_text(json.dumps(precos, indent=2, ensure_ascii=False))
    return precos


# ══════════════════════════════════════════════════════════
# CONTRATO ATIVO
# ══════════════════════════════════════════════════════════

def ativar_contrato(slug):
    """Define qual contrato está ativo."""
    _ensure_dirs()
    ATIVO_PATH.write_text(json.dumps({"slug": slug, "ativado_em": datetime.now().isoformat()}))
    return slug


def get_contrato_ativo_slug():
    """Retorna slug do contrato ativo."""
    if ATIVO_PATH.exists():
        try:
            return json.loads(ATIVO_PATH.read_text()).get("slug")
        except:
            pass
    return None


# ══════════════════════════════════════════════════════════
# NÚCLEOS DENTRO DO CONTRATO
# ══════════════════════════════════════════════════════════

def criar_nucleo(nome, contrato_slug=None):
    """Cria núcleo dentro do contrato ativo."""
    slug_c = contrato_slug or get_contrato_ativo_slug()
    if not slug_c:
        raise ValueError("Nenhum contrato ativo")
    
    slug_n = _slug(nome)
    nucleo_dir = CONTRATOS_DIR / slug_c / "nucleos" / slug_n
    nucleo_dir.mkdir(parents=True, exist_ok=True)
    
    # Criar rede vazia
    rede = {"pvs": {}, "trechos": [], "meta": {"nucleo": nome, "criado_em": datetime.now().isoformat()}}
    (nucleo_dir / "rede.json").write_text(json.dumps(rede, indent=2, ensure_ascii=False))
    
    # Atualizar lista no contrato
    contrato = get_contrato(slug_c)
    if nome not in contrato.get("nucleos", []):
        contrato.setdefault("nucleos", []).append(nome)
        (CONTRATOS_DIR / slug_c / "contrato.json").write_text(
            json.dumps(contrato, indent=2, ensure_ascii=False))
    
    return nucleo_dir


def salvar_rede_nucleo(pvs, trechos, nucleo_nome, contrato_slug=None, meta=None):
    """Salva pvs + trechos num núcleo."""
    slug_c = contrato_slug or get_contrato_ativo_slug()
    slug_n = _slug(nucleo_nome)
    nucleo_dir = CONTRATOS_DIR / slug_c / "nucleos" / slug_n
    nucleo_dir.mkdir(parents=True, exist_ok=True)
    
    rede = {
        "pvs": pvs,
        "trechos": trechos,
        "meta": {
            "nucleo": nucleo_nome,
            "n_pvs": len(pvs),
            "n_trechos": len(trechos),
            "extensao_m": round(sum(t.get("ext_m", 0) for t in trechos), 1),
            "salvo_em": datetime.now().isoformat(),
            **(meta or {}),
        }
    }
    (nucleo_dir / "rede.json").write_text(json.dumps(rede, indent=2, ensure_ascii=False))
    return nucleo_dir


def carregar_rede_nucleo(nucleo_nome, contrato_slug=None):
    """Carrega pvs + trechos de um núcleo."""
    slug_c = contrato_slug or get_contrato_ativo_slug()
    slug_n = _slug(nucleo_nome)
    path = CONTRATOS_DIR / slug_c / "nucleos" / slug_n / "rede.json"
    
    if not path.exists():
        return None, None
    
    data = json.loads(path.read_text())
    return data.get("pvs", {}), data.get("trechos", [])


def listar_nucleos(contrato_slug=None):
    """Lista núcleos do contrato."""
    slug_c = contrato_slug or get_contrato_ativo_slug()
    if not slug_c:
        return []
    
    nucleos_dir = CONTRATOS_DIR / slug_c / "nucleos"
    if not nucleos_dir.exists():
        return []
    
    nucleos = []
    for d in sorted(nucleos_dir.iterdir()):
        if d.is_dir() and (d / "rede.json").exists():
            rede = json.loads((d / "rede.json").read_text())
            meta = rede.get("meta", {})
            nucleos.append({
                "slug": d.name,
                "nome": meta.get("nucleo", d.name),
                "n_pvs": meta.get("n_pvs", len(rede.get("pvs", {}))),
                "n_trechos": meta.get("n_trechos", len(rede.get("trechos", []))),
                "extensao_m": meta.get("extensao_m", 0),
            })
    return nucleos


# ══════════════════════════════════════════════════════════
# EXPORT / IMPORT (portabilidade)
# ══════════════════════════════════════════════════════════

def exportar_contrato(slug, out_path):
    """Exporta contrato inteiro como ZIP (pra levar pra outro PC)."""
    import zipfile
    contrato_dir = CONTRATOS_DIR / slug
    if not contrato_dir.exists():
        raise FileNotFoundError(f"Contrato '{slug}' não encontrado")
    
    with zipfile.ZipFile(out_path, 'w', zipfile.ZIP_DEFLATED) as zf:
        for f in contrato_dir.rglob("*"):
            if f.is_file():
                zf.write(f, f.relative_to(contrato_dir))
    
    return out_path


def importar_contrato(zip_path):
    """Importa contrato de um ZIP."""
    import zipfile
    _ensure_dirs()
    
    with zipfile.ZipFile(zip_path) as zf:
        # Ler contrato.json pra pegar o slug
        if "contrato.json" in zf.namelist():
            data = json.loads(zf.read("contrato.json"))
            slug = _slug(f"{data.get('numero','')}_{data.get('nome','imported')}")
        else:
            slug = _slug(Path(zip_path).stem)
        
        dest = CONTRATOS_DIR / slug
        dest.mkdir(parents=True, exist_ok=True)
        zf.extractall(dest)
    
    return slug


# ══════════════════════════════════════════════════════════
# CRIAR CONTRATOS PRONTOS (templates)
# ══════════════════════════════════════════════════════════

def criar_slnr_santos():
    """Cria o contrato SLNR Santos já configurado."""
    c = criar_contrato(
        nome="SE LIGA NA REDE Santos",
        numero="11481051",
        contratante="SABESP",
        cidade="Santos",
        estado="SP",
        tipo_obra="agua_esgoto",
        bdi=25.0,
        custo_metro=910.0,
        valor_contrato=46197060,
    )
    
    # Importar preços reais
    slug = _slug("11481051_se_liga_na_rede_santos")
    precos = get_precos(slug)
    precos["materiais"].update({
        "Tubo PVC DN200": {"tipo": "ESG", "un": "m", "preco": 200.12},
        "Tubo PVC DN300": {"tipo": "ESG", "un": "m", "preco": 310.00},
        "PV concreto DN1200": {"tipo": "ESG", "un": "un", "preco": 3686.00},
        "PI plástico DN600": {"tipo": "ESG", "un": "un", "preco": 1412.00},
        "Caixa inspeção": {"tipo": "ESG", "un": "un", "preco": 1034.00},
        "Tubo PEAD DN63": {"tipo": "AG", "un": "m", "preco": 85.00},
        "Tubo PEAD DN110": {"tipo": "AG", "un": "m", "preco": 101.80},
        "PEAD PE80 DN160": {"tipo": "AG", "un": "m", "preco": 145.00},
        "Sela eletrofusão": {"tipo": "AG", "un": "un", "preco": 660.00},
        "Cavalete/hidrom.": {"tipo": "AG", "un": "un", "preco": 490.00},
        "Areia": {"tipo": "GERAL", "un": "m³", "preco": 160.00},
        "Berço": {"tipo": "GERAL", "un": "m³", "preco": 160.00},
        "Brita base": {"tipo": "GERAL", "un": "m³", "preco": 210.00},
        "Concreto": {"tipo": "GERAL", "un": "m³", "preco": 720.00},
        "CBUQ provisório": {"tipo": "GERAL", "un": "m²", "preco": 55.00},
        "CBUQ definitivo": {"tipo": "GERAL", "un": "m²", "preco": 120.00},
    })
    (CONTRATOS_DIR / slug / "precos.json").write_text(json.dumps(precos, indent=2, ensure_ascii=False))
    
    return c


# ══════════════════════════════════════════════════════════
# CLI
# ══════════════════════════════════════════════════════════

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("╔═══════════════════════════════════════════════════╗")
        print("║  ConstruData — Gestor Multi-Contrato              ║")
        print("╠═══════════════════════════════════════════════════╣")
        print("║  Comandos:                                        ║")
        print("║    criar <nome> --cidade X --estado SP            ║")
        print("║    listar                                         ║")
        print("║    ativar <slug>                                  ║")
        print("║    nucleos                                        ║")
        print("║    slnr    (cria SLNR Santos pré-configurado)     ║")
        print("╚═══════════════════════════════════════════════════╝")
        
        contratos = listar_contratos()
        if contratos:
            print(f"\n  Contratos existentes ({len(contratos)}):")
            for c in contratos:
                marca = " ◄ ATIVO" if c["ativo"] else ""
                print(f"    {'●' if c['ativo'] else '○'} {c['slug']:30s} | {c['nome']:25s} | {c['cidade']}/{c['estado']} | {c['n_nucleos']} núcleos{marca}")
        else:
            print("\n  Nenhum contrato. Execute: python motor_contratos.py slnr")
        sys.exit(0)
    
    cmd = sys.argv[1]
    
    if cmd == "slnr":
        c = criar_slnr_santos()
        print(f"✅ SLNR Santos criado e ativado: {c['nome']}")
    
    elif cmd == "listar":
        for c in listar_contratos():
            print(f"  {'●' if c['ativo'] else '○'} {c['slug']:30s} | {c['nome']}")
    
    elif cmd == "criar":
        nome = sys.argv[2] if len(sys.argv) > 2 else input("Nome: ")
        cidade = ""
        estado = "SP"
        for i, arg in enumerate(sys.argv):
            if arg == "--cidade" and i + 1 < len(sys.argv): cidade = sys.argv[i+1]
            if arg == "--estado" and i + 1 < len(sys.argv): estado = sys.argv[i+1]
        c = criar_contrato(nome, cidade=cidade, estado=estado)
        print(f"✅ Contrato criado: {c['nome']} ({cidade}/{estado})")
    
    elif cmd == "ativar":
        slug = sys.argv[2]
        ativar_contrato(slug)
        print(f"✅ Contrato ativo: {slug}")
    
    elif cmd == "nucleos":
        for n in listar_nucleos():
            print(f"  {n['nome']:25s} | {n['n_pvs']} PVs | {n['n_trechos']} tr | {n['extensao_m']}m")
