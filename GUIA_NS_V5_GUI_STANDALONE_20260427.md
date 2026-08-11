# GUI Standalone - Nota de Servico v5

## Arquivos

```text
ns_v5_gui.py
ABRIR_NS_V5_GUI.bat
```

## Como abrir

```text
Duplo clique em ABRIR_NS_V5_GUI.bat
```

Ou:

```powershell
python ns_v5_gui.py
```

## O que faz

```text
Carrega JSON com pvs+trechos.
Carrega DXF usando o motor v5.
Permite criar uma NS manual.
Gera A4, desenho, cartografia/perfil, HTML mapa, GeoJSON e DADOS.json.
Nao sobe servidor, nao abre frontend, nao mistura com a plataforma ConstruData.
```

## Formato JSON aceito

```json
{
  "nucleo": "OBRA",
  "pvs": {
    "PV_01": {"x": 357840, "y": 7357810, "ct": 8.07, "cf": 6.87},
    "PV_02": {"x": 357910, "y": 7357812, "ct": 7.54, "cf": 6.34}
  },
  "trechos": [
    {"pv_ini": "PV_01", "pv_fim": "PV_02", "dn_mm": 150, "ext_m": 69.4, "decl_mm": 0.005, "material": "PVC", "rua": "Rua"}
  ]
}
```

## Rollback

```text
Apagar ns_v5_gui.py.
Apagar ABRIR_NS_V5_GUI.bat.
Apagar GUIA_NS_V5_GUI_STANDALONE_20260427.md.
```
