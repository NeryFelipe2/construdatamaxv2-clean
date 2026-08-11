# Pacote NS v5

Este pacote serve apenas para gerar Nota de Servico v5. Nao depende do frontend ConstruData.

## Abrir

```text
ABRIR_NS_V5_GUI.bat
```

## Se faltar biblioteca

```text
INSTALAR_DEPENDENCIAS.bat
```

## Arquivos principais

```text
ns_v5_gui.py       -> tela
gerar_ns.py        -> motor de PDF/HTML/GeoJSON
ler_dxf_gdal.py    -> leitor DXF
ler_landxml.py     -> leitor LandXML opcional
EXEMPLO_NS_V5.json -> exemplo para testar
```

## Saida gerada

```text
SAIDA_NS_V5_GUI/
  NS001_PV_01_AO_PV_02/
    *_A4.pdf
    *_DESENHO.pdf
    *_CARTOGRAFIA.pdf
    *_MAPA.html
    *.geojson
    *_DADOS.json
```
