"""
QGIS: preenche Diametro e Comp_Real a partir de rotulos CAD/DXF.

Uso rapido:
1. Abra a tabela/camada dos trechos no QGIS.
2. Deixe essa camada ativa.
3. Ajuste NOME_CAMADA_ROTULOS se a deteccao automatica nao achar.
4. Console Python do QGIS:
   exec(open(r"C:\\Users\\felip\\Desktop\\_ORGANIZADO\\22-NOVA-NS-VERSAO-5\\NOVA NS Versao 5\\scripts\\preencher_diametro_comp_real_por_rotulo_qgis.py").read())
"""

import re
import unicodedata

from qgis.PyQt.QtCore import QVariant
from qgis.core import QgsField, QgsProject, QgsSpatialIndex


NOME_CAMADA_TUBOS = ""      # vazio = camada ativa no QGIS
NOME_CAMADA_ROTULOS = ""    # vazio = tenta detectar camada de textos
CAMPO_TEXTO_ROTULO = ""     # vazio = tenta detectar campo Text/TEXT/text

CAMPO_DIAMETRO = "Diametro"
CAMPO_COMPRIMENTO = "Comp_Real"

DIST_MAX_BUSCA = 8.0        # unidades do mapa
MAX_CANDIDATOS = 25
SOBRESCREVER = True
PALAVRAS_CAMADA_ROTULO = ("TEXTO", "TEXT", "MTEXT", "ROTULO", "RÓTULO", "LABEL", "ANOT", "COTA", "COMP", "DIAM", "DN")
IGNORAR_CAMADAS = (" PI ", " PV ", "PONTO", "POCO", "POÇO", "NODE", "JUNCTION")


def _sem_acento(txt):
    txt = str(txt or "").replace("Ø", " DIAM ").replace("ø", " DIAM ")
    return "".join(
        c for c in unicodedata.normalize("NFKD", txt)
        if not unicodedata.combining(c)
    ).upper()


def _num(valor):
    txt = str(valor).strip()
    if "," in txt:
        txt = txt.replace(".", "").replace(",", ".")
    return float(txt)


def extrair_rotulo(texto):
    original = str(texto or "")
    txt = _sem_acento(original)

    diametro = None
    for padrao in (
        r"\b(?:DN|DIAM(?:ETRO)?|DIA|D)\s*[:=\-]?\s*(\d{2,4})\s*(?:MM)?\b",
        r"\b(\d{2,4})\s*MM\b",
    ):
        m = re.search(padrao, txt)
        if m:
            diametro = int(m.group(1))
            break

    if diametro is None:
        for n in re.findall(r"\b\d{2,4}\b", txt):
            v = int(n)
            if 40 <= v <= 3000:
                diametro = v
                break

    comprimento = None
    for padrao in (
        r"\b(?:COMP(?:RIMENTO)?|COMPR|EXT(?:ENSAO)?|L)\s*[:=\-]?\s*(\d+(?:[,.]\d+)?)\s*(?:M|ML)?\b",
        r"\b(\d+(?:[,.]\d+)?)\s*(?:M|ML)\b",
    ):
        m = re.search(padrao, txt)
        if m:
            comprimento = _num(m.group(1))
            break

    if comprimento is None:
        for n in re.findall(r"\b\d+[,.]\d+\b", txt):
            v = _num(n)
            if 0.01 <= v <= 10000 and int(round(v)) != diametro:
                comprimento = v
                break

    return diametro, comprimento


def _camada_por_nome(nome):
    achadas = QgsProject.instance().mapLayersByName(nome)
    if not achadas:
        raise RuntimeError(f"Camada nao encontrada: {nome}")
    return achadas[0]


def _camada_tubos():
    if NOME_CAMADA_TUBOS:
        return _camada_por_nome(NOME_CAMADA_TUBOS)
    if "iface" in globals() and iface.activeLayer():
        return iface.activeLayer()
    raise RuntimeError("Defina NOME_CAMADA_TUBOS ou deixe a camada de tubos ativa.")


def _campo_texto(layer):
    if CAMPO_TEXTO_ROTULO:
        return CAMPO_TEXTO_ROTULO

    nomes = [f.name() for f in layer.fields()]
    for nome in ("Text", "TEXT", "text", "Texto", "TEXTO", "rotulo", "Rotulo", "Label", "LABEL"):
        if nome in nomes:
            return nome

    for campo in layer.fields():
        if campo.type() == QVariant.String:
            return campo.name()

    return None


def _camada_rotulos(tubos):
    if NOME_CAMADA_ROTULOS:
        return _camada_por_nome(NOME_CAMADA_ROTULOS)

    candidatas = []
    for layer in QgsProject.instance().mapLayers().values():
        if layer.id() == tubos.id() or not hasattr(layer, "fields"):
            continue
        nome = f" {layer.name().upper()} "
        if any(p in nome for p in IGNORAR_CAMADAS):
            continue
        campo = _campo_texto(layer)
        if not campo:
            continue
        qtd = 0
        amostra = ""
        for i, f in enumerate(layer.getFeatures()):
            if i > 200:
                break
            texto = f[campo]
            if any(extrair_rotulo(texto)):
                qtd += 1
                amostra = amostra or str(texto)[:80]
        if qtd:
            score = qtd + (1000 if any(p in nome for p in PALAVRAS_CAMADA_ROTULO) else 0)
            candidatas.append((score, qtd, layer, amostra))

    if candidatas:
        candidatas.sort(reverse=True, key=lambda x: x[0])
        print("Camadas candidatas de rotulo:")
        for _, qtd, layer, amostra in candidatas[:10]:
            print(f"- {layer.name()} | {qtd} rotulo(s) | exemplo: {amostra}")
        return candidatas[0][2]

    raise RuntimeError("Camada de rotulos nao detectada. Preencha NOME_CAMADA_ROTULOS.")


def _garantir_campos(layer):
    novos = []
    if layer.fields().indexFromName(CAMPO_DIAMETRO) < 0:
        novos.append(QgsField(CAMPO_DIAMETRO, QVariant.Int))
    if layer.fields().indexFromName(CAMPO_COMPRIMENTO) < 0:
        novos.append(QgsField(CAMPO_COMPRIMENTO, QVariant.Double, len=12, prec=2))
    if novos:
        layer.dataProvider().addAttributes(novos)
        layer.updateFields()

    return (
        layer.fields().indexFromName(CAMPO_DIAMETRO),
        layer.fields().indexFromName(CAMPO_COMPRIMENTO),
    )


def _valor_para_campo(campo, valor, casas=2):
    if valor is None:
        return None
    if campo.type() in (QVariant.Int, QVariant.UInt, QVariant.LongLong, QVariant.ULongLong):
        return int(round(valor))
    if campo.type() == QVariant.Double:
        return float(valor)
    return f"{valor:.{casas}f}".replace(".", ",") if casas else str(int(round(valor)))


def _vazio(valor):
    return valor is None or str(valor).strip().lower() in ("", "null", "none")


def _ponto_busca(geom):
    p = geom.pointOnSurface()
    return p.asPoint() if p and not p.isEmpty() else geom.boundingBox().center()


def executar():
    tubos = _camada_tubos()
    rotulos = _camada_rotulos(tubos)
    campo_texto = _campo_texto(rotulos)
    idx_diam, idx_comp = _garantir_campos(tubos)

    rotulos_features = list(rotulos.selectedFeatures()) or list(rotulos.getFeatures())
    parsed = {}
    index = QgsSpatialIndex()
    for f in rotulos_features:
        diam, comp = extrair_rotulo(f[campo_texto])
        if diam is None and comp is None:
            continue
        parsed[f.id()] = (f, diam, comp)
        index.addFeature(f)

    if not parsed:
        raise RuntimeError("Nenhum rotulo com diametro/comprimento foi encontrado.")

    trechos = list(tubos.selectedFeatures()) or list(tubos.getFeatures())
    ja_editando = tubos.isEditable()
    if not ja_editando:
        tubos.startEditing()

    manual = tubos.selectedFeatureCount() > 0 and rotulos.selectedFeatureCount() == 1
    alterados = 0
    for trecho in trechos:
        melhor_diam = (None, 10**12)
        melhor_comp = (None, 10**12)

        if manual:
            _, diam, comp = next(iter(parsed.values()))
            melhor_diam = (diam, 0)
            melhor_comp = (comp, 0)
        else:
            geom = trecho.geometry()
            for fid in index.nearestNeighbor(_ponto_busca(geom), MAX_CANDIDATOS):
                rotulo, diam, comp = parsed[fid]
                dist = geom.distance(rotulo.geometry())
                if dist > DIST_MAX_BUSCA:
                    continue
                if diam is not None and dist < melhor_diam[1]:
                    melhor_diam = (diam, dist)
                if comp is not None and dist < melhor_comp[1]:
                    melhor_comp = (comp, dist)

        mudou = False
        campo_diam = tubos.fields()[idx_diam]
        campo_comp = tubos.fields()[idx_comp]

        if melhor_diam[0] is not None and (SOBRESCREVER or _vazio(trecho[idx_diam])):
            tubos.changeAttributeValue(trecho.id(), idx_diam, _valor_para_campo(campo_diam, melhor_diam[0], 0))
            mudou = True
        if melhor_comp[0] is not None and (SOBRESCREVER or _vazio(trecho[idx_comp])):
            tubos.changeAttributeValue(trecho.id(), idx_comp, _valor_para_campo(campo_comp, melhor_comp[0], 2))
            mudou = True

        if mudou:
            alterados += 1

    if not ja_editando:
        tubos.commitChanges()

    print(f"OK: {alterados} trecho(s) atualizados em {tubos.name()} usando rotulos de {rotulos.name()}.")


executar()
