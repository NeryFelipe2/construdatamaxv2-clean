# PROMPT PARA CLAUDE CODE — ConstruData HydroNetwork BIM 5D v7
## Continuidade da plataforma · Março 2026

---

## 📁 LOCALIZAÇÃO DO CÓDIGO

```
C:\Users\felip\Downloads\NOVA NS Versao 5\CONSTRUDATA_HYDRONETWORK_V7_FINAL\
```

### Estrutura atual:
```
PACOTE_FINAL_V2/
├── MANUAL_CONSTRUDATA.md          ← LEIA PRIMEIRO — manual completo com fluxograma
├── VERDE_TETEU_3D.ifc             ← Exemplo IFC 3D real (887KB, ifcopenshell)
│
├── scripts/                        ← 9 módulos Python
│   ├── ler_dxf_gdal.py            ← Leitor DXF ProSaneamento (água+esgoto) v4
│   ├── ler_dwg_aec.py             ← Leitor DWG Civil 3D (AEC Proxy desbloqueado)
│   ├── ler_landxml.py             ← Leitor LandXML (export Civil 3D)
│   ├── gerar_ns.py                ← Gerador NS campo (PDF+JSON+HTML+GeoJSON)
│   ├── gerar_civil3d.py           ← LandXML + Cadastro DXF + Dynamo + .scr
│   ├── gerar_cadastro_nts292.py   ← DXF georref as-built NTS 292
│   ├── gerar_ifc_lod500.py        ← IFC 3D REAL (SweptDiskSolid + ExtrudedAreaSolid + 3 PropertySets)
│   ├── gerar_project_xml.py       ← MS Project XML cronograma
│   └── construdata_pipeline.py    ← Orquestrador (detecta formato → roda tudo)
│
├── html/                           ← 5 interfaces visuais
│   ├── construdata_editor.html    ← Editor de rede estilo EPANET (Leaflet)
│   ├── construdata_manage.html    ← Viewer 3D (Three.js) + 5D
│   ├── construdata_controle.html  ← As-Built + Medição + Curva S
│   ├── FLUXOGRAMA_BIM_5D.html     ← Fluxograma do sistema
│   └── ARQUITETURA_BIM_5D.html    ← Diagrama de arquitetura
│
├── catalogos/
│   └── AeccCatCfg.xml             ← Catálogos SABESP (PVC+PEAD+PV) para Civil 3D
│
└── bat/
    ├── ABRIR.bat                   ← Launcher Windows
    └── EXPORTAR_PIPE_NETWORKS.bat  ← Export Pipe Networks do Civil 3D
```

---

## ⚠️ REGRAS INVIOLÁVEIS

1. **NUNCA** usar "FCN Construções e Saneamento" em NENHUMA saída — usar **"FCN Construções e Saneamento"**
2. Plataforma = **"ConstruData - HydroNetwork"**
3. Custos vêm da **tabela do contrato** (importada pelo usuário), NÃO do SINAPI fixo
4. Medição é pela **Nota de Serviço** (1 NS = 1 trecho)
5. Sempre **água + esgoto**, nunca só um
6. CRS = **EPSG:31983** (SIRGAS 2000 UTM 23S)

---

## 🎨 GUI — IMPORTANTE

As interfaces HTML em `html/` são o **design de referência** para qualquer GUI Python (Tkinter, PyQt, web).

Se for criar `gui.py`, **replicar exatamente o visual e funcionalidade** dos HTMLs:

### construdata_editor.html (PRINCIPAL)
- Fundo escuro (#06060f), acento verde (#00ff88), azul água (#00aaff)
- Font: Manrope (display) + JetBrains Mono (dados)
- Layout: toolbar lateral esquerda (56px) + mapa central (Leaflet) + painel direito (380px)
- **Ferramentas estilo EPANET:** ↖ Selecionar (V) · ⊕ PV (P) · ━ Tubo (T) · ✥ Mover (M) · ✕ Apagar (Del)
- **4 abas no painel direito:** Propriedades · NS · Cadastro · Custo
- Editar CT, CF, DN, material → Manning calcula em tempo real
- Import/Export JSON compatível com o pipeline Python
- Atalhos teclado: P, T, V, M, Del, F, Ctrl+Z, Escape

### construdata_manage.html (3D VIEWER)
- Three.js r128
- 5 modos: 3D / Custo (cor) / Hidráulica (cor) / DN (cor) / Timeline 4D
- Click em elemento → painel lateral com propriedades + custo
- Z exaggeration slider (1-20×)
- Pipe scale slider (1-15×)
- Vista Planta / Vista 3D

### construdata_controle.html (CONTROLE)
- 4 abas: As-Built · Medição (BM) · Curva S · Resumo 5D
- Tabela editável (180+ NS com status)
- Gráficos Curva S: previsto (verde) vs real (amarelo tracejado)

---

## 🔗 FORMATO INTERNO (pvs + trechos)

Todo script lê ou gera esse formato. Qualquer GUI deve usar o mesmo.

```python
pvs = {
    "PV01": {
        "x": 362293.456,      # Easting UTM
        "y": 7352565.123,     # Northing UTM
        "ct": 5.20,           # Cota Terreno (m)
        "cf": 3.70,           # Cota Fundo (m)
        "tipo": "esgoto",     # "esgoto" | "agua"
        "material_pv": "CONCRETO",
    },
}

trechos = [
    {
        "pv_ini": "PV01",
        "pv_fim": "PV02",
        "dn_mm": 200,
        "ext_m": 14.5,
        "decl_mm": 8.5,       # ‰
        "material": "PVC",
        "tipo": "esgoto",
    },
]
```

---

## 🧮 CÁLCULOS JÁ IMPLEMENTADOS

### Manning (esgoto)
```
V = (1/n) × Rh^(2/3) × I^(1/2)    n: PVC=0.013, PEAD=0.011, Concreto=0.015
Q = V × A × 1000 (L/s)
τ = γ × Rh × I (Pa)                τ_min = 1.0 Pa (NBR 9649)
```

### Custo 5D (por trecho)
```
Custo_tubo     = preço_unit × extensão
Custo_escav    = preço_m³ × ext × prof_med × largura_vala(0.8m)
Custo_reaterro = preço_m³ × vol_escav × 0.85
Custo_repav    = preço_m² × ext × largura_vala
Custo_PV       = preço_unit × 1
```

### IFC Geometria (ifcopenshell)
```
Tubo → IfcSweptDiskSolid(directrix=polyline, raio_ext=DN/2, raio_int=DN/2×0.9)
PV   → IfcExtrudedAreaSolid(circle Ø1200mm PV / Ø600mm PI, altura=profundidade)
PropertySets: Dados_Tecnicos + SABESP_Hidraulica + Custo5D + Dados_PV
```

---

## 🔬 REDES JÁ PROCESSADAS E TESTADAS

| Rede | Tipo | PVs | Trechos | Extensão |
|------|------|-----|---------|----------|
| Verde e Teteu | Esgoto | 357 | 180 | 2.621m |
| Pantanal | Esgoto | 306 | 189 | ~7.700m |
| Pantanal | Água | 348 | 372 | 6.986m |
| Criadores | Água | 122 | 130 | 4.138m |
| Teteu | Água | 337 | 346 | 4.813m |
| Israel | Água | 812 | 861 | 11.509m |
| São Manoel | Esgoto | 20 | 16 | 1.275m |

**Total: 2.304 PVs · 2.094 trechos · ~39 km**

---

## 🚧 PRÓXIMOS MÓDULOS A CONSTRUIR

| Módulo | Prioridade | O que faz |
|--------|-----------|-----------|
| `motor_custo.py` | 🔴 ALTA | Importar tabela de preços do contrato (CSV/Excel), aplicar por NS |
| `motor_medicao.py` | 🔴 ALTA | NS executada → BM mensal → Curva S automática |
| Pipe Network paramétrico | 🟡 MÉDIA | Mexer PV → recalcula extensão → declividade → Manning → custo → IFC |
| `gerar_primavera.py` | 🟡 MÉDIA | Export Primavera P6 (formato XER) |
| `gerar_openproject.py` | 🟡 MÉDIA | Export OpenProject (CSV com WBS) |
| `ler_pdf_projeto.py` | 🟢 BAIXA | Ler tabelas de perfil longitudinal em PDF |
| Cronograma macro | 🟡 MÉDIA | WBS multinúcleo: Contrato → Núcleo → Fase → NS |

---

## 💡 INSTRUÇÕES PARA CLAUDE CODE

1. **Primeiro:** Leia `MANUAL_CONSTRUDATA.md` — tem o fluxograma completo e regras
2. **Segundo:** Leia os scripts em `scripts/` — entenda o formato pvs+trechos
3. **Terceiro:** Leia os HTMLs em `html/` — esse é o visual de referência para qualquer GUI
4. **Se for criar gui.py:** Replicar o layout e cores dos HTMLs. Tema escuro. Mesmo fluxo de interação.
5. **Se for evoluir scripts:** Manter a interface `pvs, trechos = leitor(arquivo)` e `paths = gerador(pvs, trechos, nucleo, out_dir)`
6. **NUNCA** quebrar compatibilidade do formato pvs+trechos — todos os módulos dependem dele
7. **SEMPRE** testar com dados reais (Verde e Teteu: 357 PVs, 180 trechos)

---

## 📊 ESTATÍSTICAS DO PROJETO

- **6.275 linhas** de código (Python + HTML)
- **12 arquivos** de código fonte
- **9 scripts** Python
- **5 interfaces** HTML
- **337 KB** de código fonte
- **39 km** de rede processada
- **Testado e validado** pipeline 7/7 etapas
