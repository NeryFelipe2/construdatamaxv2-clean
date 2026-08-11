import math
import logging

log = logging.getLogger(__name__)

def parse_topografia_txt(filepath: str):
    """
    Lê o arquivo do topógrafo.
    Formatos comuns suportados:
    ID, N (Y), E (X), Z (Cota), Codigo, Descicao
    Retorna uma lista de dicts.
    """
    pontos = []
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            lines = f.readlines()
    except UnicodeDecodeError:
        try:
            with open(filepath, 'r', encoding='cp1252') as f:
                lines = f.readlines()
        except Exception as e:
            log.error(f"Erro ao ler topografia: {e}")
            return []

    for line in lines:
        line = line.strip()
        if not line or line.startswith('#') or line.startswith('//'):
            continue
        
        parts = line.split(',')
        if len(parts) >= 6:
            # Modelo padrão: 8001, 7352710.3103, 359320.6469, 2.1151, 86, PVE
            try:
                # O Brasil (UTM Sul) tem Y (Norte) na casa dos milhões (ex: 7352710)
                # E X (Este) na casa dos milhares (ex: 359320)
                # Vamos identificar automaticamente qual coluna é qual pelo valor
                v1, v2 = float(parts[1]), float(parts[2])
                if v1 > v2: 
                    norte, este = v1, v2
                else:
                    este, norte = v1, v2
                
                cota = float(parts[3])
                desc = parts[5].strip().upper()
                
                pontos.append({
                    "id": parts[0].strip(),
                    "norte": norte,
                    "este": este,
                    "cota": cota,
                    "desc": desc
                })
            except ValueError:
                continue
    return pontos


def interpolar_as_built(pvs_projeto: dict, pontos_topo: list, raio_busca=15.0):
    """
    Faz o 'snap' espacial. Para cada PV no projeto teórico,
    procura o ponto coletado pelo topógrafo (com descrição PV/PVE/PI)
    mais próximo dentro do `raio_busca` e atualiza suas coordenadas
    para o valor real de campo, simulando o As-Built verdadeiro.
    """
    if not pontos_topo:
        return pvs_projeto

    # Filtra apenas pontos que representam estruturas da rede
    palavras_chave = ["PV", "PVE", "PI", "PVA", "REDE", "TL"]
    estruturas_topo = [
        p for p in pontos_topo
        if any(kw in p["desc"] for kw in palavras_chave)
    ]

    pvs_asbuilt = {}
    snaps_feitos = 0

    for nome_pv, dados in pvs_projeto.items():
        # Copia dados originais para não destruir o dict base se falhar
        novo_pv = dict(dados)
        
        px_proj = float(dados.get("x", 0))
        py_proj = float(dados.get("y", 0))

        if px_proj == 0 and py_proj == 0:
            pvs_asbuilt[nome_pv] = novo_pv
            continue
        
        # Encontrar ponto de topografia mais próximo
        ponto_proximo = None
        menor_dist = float('inf')
        
        for pt in estruturas_topo:
            dx = pt["este"] - px_proj
            dy = pt["norte"] - py_proj
            dist = math.sqrt(dx*dx + dy*dy)
            
            if dist < menor_dist and dist <= raio_busca:
                menor_dist = dist
                ponto_proximo = pt
                
        if ponto_proximo:
            novo_pv["x"] = ponto_proximo["este"]
            novo_pv["y"] = ponto_proximo["norte"]
            
            # Atualiza Cota Tampa com a Cota Real medida em campo
            cota_tampa_antiga = float(novo_pv.get("ct", 0) or 0)
            nova_cota = ponto_proximo["cota"]
            novo_pv["ct"] = nova_cota
            
            # Recalcula a cota fundo se tínhamos PROFundidade teórica definida
            try:
                prof = float(novo_pv.get("prof", 0) or 0)
                if prof > 0:
                    novo_pv["cf"] = nova_cota - prof
            except (ValueError, TypeError):
                pass
                
            snaps_feitos += 1
            novo_pv["as_built"] = True
            novo_pv["dist_erro_ok"] = menor_dist
        else:
            novo_pv["as_built"] = False
            
        pvs_asbuilt[nome_pv] = novo_pv

    log.info(f"Topografia interpolada: fez snap real (As-Built) de {snaps_feitos}/{len(pvs_projeto)} PVs.")
    return pvs_asbuilt
