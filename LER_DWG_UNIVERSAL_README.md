# LEITOR DWG UNIVERSAL - DOCUMENTAÇÃO

## 📋 VISÃO GERAL

O **`ler_dwg_universal.py`** é um leitor DWG **INDEPENDENTE** que NÃO MEXE nos botões DWG existentes da GUI.

### Diferença para os Leitores Existentes

| Leitor | Método | Botão GUI | Uso |
|--------|--------|-----------|-----|
| `ler_dwg_aec.py` | Converte DWG→DXF via libredwg | "DWG Civil 3D" (fluxo normal) | AEC Proxy Objects |
| `ler_dwg_semantico.py` | Lê via Civil 3D COM API | "DWG SEMANTICO" (botão dedicado) | Pipe Network BIM completo |
| **`ler_dwg_universal.py`** | **Múltiplos métodos (ODA/libredwg)** | **NENHUM (independente)** | **DWGs de QUALQUER software** |

---

## 🚀 COMO USAR

### Método 1: Linha de Comando

```bash
python ler_dwg_universal.py "CAMINHO\ARQUIVO.dwg"
```

**Opções:**
```bash
# Usar método específico
python ler_dwg_universal.py ARQUIVO.dwg --metodo oda
python ler_dwg_universal.py ARQUIVO.dwg --metodo libredwg

# Salvar resultado em JSON
python ler_dwg_universal.py ARQUIVO.dwg --saida resultado.json

# Ajuda
python ler_dwg_universal.py --help
```

### Método 2: Python

```python
from ler_dwg_universal import ler_dwg_universal

pvs, trechos, meta = ler_dwg_universal("ARQUIVO.dwg")

print(f"PVs: {len(pvs)}")
print(f"Trechos: {len(trechos)}")
print(f"Meta: {meta}")
```

---

## 🔧 MÉTODOS DE CONVERSÃO

### 1. ODA File Converter (Windows) ⭐ RECOMENDADO

**O que é:** Conversor gratuito da Open Design Alliance

**Instalação:**
```
Download: https://www.opendesign.com/guestfiles/oda_file_converter
```

**Caminhos procurados:**
- `C:\Program Files\ODA\ODAFileConverter\ODAFileConverter.exe`
- `C:\Program Files (x86)\ODA\ODAFileConverter\ODAFileConverter.exe`
- `C:\Program Files\Autodesk\DWG TrueView\ODAFileConverter.exe`

**Vantagens:**
- ✅ Gratuito
- ✅ Lê DWG nativamente
- ✅ Explode AEC Objects automaticamente
- ✅ Windows e Linux

### 2. libredwg (Linux/WSL)

**O que é:** Biblioteca open-source para leitura de DWG

**Instalação (Linux):**
```bash
sudo apt install libredwg
```

**Caminhos procurados:**
- `/usr/bin/dwg2dxf`
- `/usr/local/bin/dwg2dxf`
- `/tmp/libredwg/programs/dwg2dxf`

### 3. Fallback: DXF Existente

Se já existir um DXF com o mesmo nome na mesma pasta, usa diretamente.

---

## 📊 O QUE É EXTRAÍDO

### PVs (Pontos de Visita)

**Padrões reconhecidos:**
- `PV_01`, `PV-1`, `PV1` (genérico)
- `P.V. 1`, `P.V._1` (ProSaneamento)
- `PI_01`, `P.I. 1` (Inspeção)
- `POCO_1`, `POÇO-1` (QGIS)
- `STRUCT_1`, `STRUCTURE-1` (Civil 3D)

**Dados extraídos:**
- Coordenadas X, Y
- CT (Cota de Terreno)
- CF (Cota de Fundo)
- Prof (Profundidade)

### Tubos/Trechos

**Extraído:**
- PV inicial e final
- Extensão (metros)
- Layer de origem
- DN (se encontrado em textos próximos)
- Inclinação (se encontrado em textos próximos)

---

## 📝 EXEMPLO DE SAÍDA

```
======================================================================
[▶] LER DWG UNIVERSAL - REDE_ESGOTO.dwg
======================================================================
[ ] Tamanho: 2.45 MB
[▶] Tentando ODA File Converter...
[✓] ODA encontrado: C:\Program Files\ODA\ODAFileConverter\ODAFileConverter.exe
[▶] Convertendo DWG → DXF...
  [ ] Entrada: REDE_ESGOTO.dwg
  [ ] Saída: C:\Users\...\Temp\tmpxyz123\REDE_ESGOTO.dxf
[✓] DXF criado: 1024 KB
[▶] Lendo DXF: REDE_ESGOTO.dxf
[✓] Entidades: 5234
  [ ]   LWPOLYLINE: 2500
  [ ]   TEXT: 1500
  [ ]   INSERT: 800
  [ ]   MTEXT: 434
[✓] Textos: 1500
[✓] Polylines >2.0m: 450
[✓] Inserts: 800
[▶] Extraindo PVs e tubos...
  [ ]   Identificando PVs...
  [✓]   PVs candidatos: 120
  [ ]   Extraindo cotas...
  [✓]   PVs finais: 118
  [ ]   Conectando tubos...
  [✓]   Trechos conectados: 115
======================================================================
[✓] RESULTADO: 118 PVs, 115 trechos, 3250m
======================================================================
```

---

## 🛠️ INTEGRAÇÃO COM PIPELINE EXISTENTE

### Opção 1: Usar no Pipeline Manualmente

```python
from ler_dwg_universal import ler_dwg_universal
from gerar_ns import gerar_ns

# Ler DWG
pvs, trechos, meta = ler_dwg_universal("REDE.dwg")

# Gerar NS
gerar_ns(pvs, trechos, "NOME_NUCLEO", "./SAIDA")
```

### Opção 2: Adicionar Botão Dedicado na GUI (FUTURO)

Se quiser adicionar um botão "DWG UNIVERSAL" na GUI:

```python
# Em construdata_gui.py, adicionar:
def _cmd_dwg_universal(self):
    arq = self.arquivo_var.get()
    if Path(arq).suffix.lower() != ".dwg":
        messagebox.showwarning("Aviso", "Selecione um arquivo DWG")
        return
    
    self._run(self._do_dwg_universal, path=arq)

def _do_dwg_universal(self, path=None):
    from ler_dwg_universal import ler_dwg_universal
    self.pvs, self.trechos, self.meta = ler_dwg_universal(path)
```

---

## 🔍 SOLUÇÃO DE PROBLEMAS

### Problema: "ODA File Converter não encontrado"

**Solução:**
1. Baixe em: https://www.opendesign.com/guestfiles/oda_file_converter
2. Instale
3. Tente novamente

### Problema: "Nenhum texto encontrado"

**Causa:** DWG sem textos ou textos em formato não reconhecido

**Solução:**
1. Verifique se o DWG tem textos de PV
2. Execute o diagnóstico:
   ```bash
   python diagnostico_dxf_completo.py ARQUIVO_CONVERTIDO.dxf
   ```

### Problema: "Nenhum PV encontrado"

**Causa:** Textos não seguem padrões reconhecíveis

**Solução:**
1. Adicione mais padrões em `_extrair_pvs_tubos()`:
   ```python
   padroes_pv.append(
       (r'SEU_PADRAO_AQUI', lambda m: f"PV_{m.group(1)}")
   )
   ```

### Problema: "Conversão falhou"

**Solução:**
1. Tente método alternativo:
   ```bash
   python ler_dwg_universal.py ARQUIVO.dwg --metodo libredwg
   ```

2. Ou converta manualmente DWG→DXF no Civil 3D/AutoCAD

---

## 📊 COMPARAÇÃO DE MÉTODOS

| Método | Velocidade | Qualidade | Requer |
|--------|-----------|-----------|--------|
| ODA File Converter | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | Instalação ODA |
| libredwg | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | Instalação libredwg |
| DXF Existente | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | DXF prévio |

---

## 📚 ARQUIVOS RELACIONADOS

| Arquivo | Descrição |
|---------|-----------|
| `ler_dwg_universal.py` | Script principal |
| `LER_DWG_BIM.py` | Leitura via Civil 3D API (BIM completo) |
| `LER_DWG_DIRETO.py` | Leitura via ODA (alternativo) |
| `ler_dwg_aec.py` | Leitura AEC Proxy (padrão GUI) |
| `ler_dwg_semantico.py` | Leitura semântica (botão dedicado) |

---

## ✅ VANTAGENS

1. **Independente:** Não interfere nos botões DWG existentes
2. **Multi-método:** Tenta ODA, libredwg, fallback
3. **Universal:** Lê DWGs de qualquer software
4. **Robusto:** Múltiplos padrões de PV
5. **Documentado:** Log detalhado de cada etapa

---

## ⚠️ LIMITAÇÕES

1. **Não lê BIM completo:** Apenas textos e geometrias (não acessa API do Civil 3D)
2. **Depende de conversão:** Precisa do ODA ou libredwg
3. **DN/Decl estimados:** Extrai de textos próximos (não de propriedades BIM)

---

**Data:** 2026-03-27  
**Versão:** 1.0  
**Autor:** Felipe Nery
