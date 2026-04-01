#!/usr/bin/env python3
"""
MOTOR_GEMINI.PY — Integração Gemini API com ConstruData HydroNetwork
FCN Construções e Saneamento · CT 11481051

SDK: google-genai (novo, não o deprecated google-generativeai)
Modelo: gemini-2.5-flash (rápido, barato) ou gemini-2.5-pro (complexo)
API Key: https://aistudio.google.com/app/apikey (grátis até 500 req/dia)

FUNCIONALIDADES:
1. ANÁLISE DE FOTO (RDO)
   - Foto da vala → identifica material, DN, profundidade estimada
   - Foto do PV → identifica tipo, condição, observações
   - Foto da rua → identifica tipo pavimentação, largura, problemas
   - Foto geral → gera legenda automática pro RDO

2. LEITURA DE PDF DE PROJETO
   - Tabela perfil longitudinal → extrai PV, CT, CF, DN, extensão
   - Planta baixa → identifica ruas, PVs, tubulações
   - Memorial descritivo → extrai parâmetros do projeto

3. ASSISTENTE INTELIGENTE
   - "Qual o custo total do núcleo Verde e Teteu?"
   - "Quais trechos têm tensão trativa abaixo de 1 Pa?"
   - "Gere um resumo da execução desta semana"
   - "Compare produtividade do Tetéu vs Pantanal"

4. GERAÇÃO DE RELATÓRIO
   - Resumo executivo automático dos dados
   - Análise de tendências a partir da execução
   - Sugestões de otimização baseadas nos dados

pip install google-genai
"""

import json, os, base64, sys, argparse
from pathlib import Path
from datetime import datetime

# ══════════════════════════════════════════════════════════
# CONFIGURAÇÃO
# ══════════════════════════════════════════════════════════

# Prioridade: variável de ambiente > arquivo config > manual
def _get_api_key():
    """Busca API key do Gemini."""
    # 1. Variável de ambiente
    key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if key:
        return key
    
    # 2. Arquivo .env ou config.json
    for cfg_path in [".env", "config.json", os.path.expanduser("~/.construdata/config.json")]:
        if os.path.exists(cfg_path):
            try:
                if cfg_path.endswith('.json'):
                    with open(cfg_path) as f:
                        data = json.load(f)
                        key = data.get("gemini_api_key") or data.get("GEMINI_API_KEY")
                else:
                    with open(cfg_path) as f:
                        for line in f:
                            if line.strip().startswith("GEMINI_API_KEY"):
                                key = line.split("=", 1)[1].strip().strip('"').strip("'")
                if key:
                    return key
            except:
                pass
    
    return None


def _get_client():
    """Cria cliente Gemini."""
    try:
        from google import genai
    except ImportError:
        raise ImportError(
            "SDK do Gemini não instalado.\n"
            "Execute: pip install google-genai\n"
            "Depois configure a API key: export GEMINI_API_KEY='sua-chave'\n"
            "Pegue grátis em: https://aistudio.google.com/app/apikey"
        )
    
    key = _get_api_key()
    if not key:
        raise ValueError(
            "API key do Gemini não encontrada.\n"
            "Configure de uma das formas:\n"
            "  1. export GEMINI_API_KEY='sua-chave'\n"
            "  2. Crie config.json com {\"gemini_api_key\": \"sua-chave\"}\n"
            "  3. Crie .env com GEMINI_API_KEY=sua-chave\n"
            "Pegue grátis em: https://aistudio.google.com/app/apikey"
        )
    
    return genai.Client(api_key=key)


# Modelos disponíveis
MODELO_RAPIDO = "gemini-1.5-flash"      # Rápido + barato.
MODELO_PRO = "gemini-1.5-pro"           # Mais inteligente.
MODELO_V2 = "gemini-2.0-flash-exp"      # Próxima geração.


# ══════════════════════════════════════════════════════════
# 1. ANÁLISE DE FOTOS (RDO)
# ══════════════════════════════════════════════════════════

PROMPT_FOTO_VALA = """Você é um engenheiro sanitarista analisando uma foto de obra de saneamento.

Analise esta foto e retorne APENAS um JSON válido (sem markdown, sem ```):
{
  "tipo_foto": "vala|pv|pavimento|geral|material|equipamento",
  "descricao": "descrição objetiva do que vê na foto",
  "material_tubo": "PVC|PEAD|Concreto|FFD|não visível",
  "dn_estimado_mm": 200,
  "profundidade_estimada_m": 1.5,
  "tipo_solo": "arenoso|argiloso|rochoso|aterro|não visível",
  "escoramento": "sim|não|não visível",
  "condicao": "boa|regular|ruim|crítica",
  "problemas": ["lista de problemas identificados"],
  "observacoes": "observações adicionais relevantes",
  "legenda_rdo": "Legenda sugerida para o RDO (1 linha)"
}

Contexto: Obra SE LIGA NA REDE, SABESP Santos/SP. Rede de esgoto (PVC DN200/300) e água (PEAD DN63/110).
Seja objetivo e técnico. Se não conseguir identificar algo, coloque "não visível".
"""

PROMPT_FOTO_PV = """Analise esta foto de Poço de Visita (PV) de rede de esgoto.

Retorne APENAS JSON válido:
{
  "tipo_pv": "concreto|alvenaria|PEAD|plástico",
  "diametro_estimado_mm": 1200,
  "profundidade_estimada_m": 2.0,
  "tampao": "ferro fundido|concreto|ausente",
  "condicao_estrutural": "boa|regular|ruim|crítica",
  "infiltracao": "sim|não|não visível",
  "sedimento": "sim|não|não visível",
  "problemas": [],
  "legenda_rdo": "Legenda sugerida"
}
"""


def analisar_foto(caminho_foto, tipo="auto", modelo=None):
    """
    Analisa foto de obra usando Gemini Vision.
    
    Args:
        caminho_foto: caminho da imagem (jpg, png)
        tipo: "vala", "pv", "geral" ou "auto" (Gemini decide)
        modelo: modelo Gemini (default: flash)
    
    Returns:
        dict com análise estruturada
    """
    client = _get_client()
    modelo = modelo or MODELO_RAPIDO
    
    # Ler imagem
    with open(caminho_foto, "rb") as f:
        img_bytes = f.read()
    
    # Detectar MIME type
    ext = Path(caminho_foto).suffix.lower()
    mime = {"jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
            ".webp": "image/webp", ".gif": "image/gif"}.get(ext, "image/jpeg")
    
    # Escolher prompt
    if tipo == "pv":
        prompt = PROMPT_FOTO_PV
    elif tipo == "vala":
        prompt = PROMPT_FOTO_VALA
    else:
        prompt = PROMPT_FOTO_VALA  # auto: usa o mais completo
    
    from google.genai import types
    
    response = client.models.generate_content(
        model=modelo,
        contents=[
            types.Part.from_bytes(data=img_bytes, mime_type=mime),
            types.Part.from_text(text=prompt),
        ],
        config=types.GenerateContentConfig(temperature=0.2),
    )
    
    # Parse JSON da resposta
    text = response.text.strip()
    # Limpar possíveis wrappers markdown
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else text[3:]
        if text.endswith("```"):
            text = text[:-3]
    
    try:
        resultado = json.loads(text)
    except json.JSONDecodeError:
        resultado = {"raw": text, "erro": "Resposta não é JSON válido"}
    
    resultado["_meta"] = {
        "arquivo": os.path.basename(caminho_foto),
        "modelo": modelo,
        "timestamp": datetime.now().isoformat(),
    }
    
    return resultado


def analisar_fotos_lote(pasta, modelo=None):
    """Analisa todas as fotos de uma pasta (batch RDO)."""
    resultados = []
    pasta = Path(pasta)
    
    for img in sorted(pasta.glob("*")):
        if img.suffix.lower() in (".jpg", ".jpeg", ".png", ".webp"):
            try:
                r = analisar_foto(str(img), "auto", modelo)
                resultados.append(r)
                print(f"  ✅ {img.name}: {r.get('legenda_rdo', r.get('descricao', '?'))[:60]}")
            except Exception as e:
                resultados.append({"arquivo": img.name, "erro": str(e)})
                print(f"  ❌ {img.name}: {e}")
    
    return resultados


def analisar_foto_para_rdo(caminho_foto, tipo="auto", modelo=None):
    """
    Retorna uma legenda curta para RDO a partir de uma foto.

    Nunca levanta erro para o chamador. Se Gemini nao estiver disponivel,
    devolve uma legenda tecnica fallback.
    """
    caminho = Path(caminho_foto)
    fallback = {
        "legenda_rdo": f"Registro fotográfico de campo - {caminho.stem.replace('_', ' ')}".strip(),
        "descricao": "Imagem recebida para compor o RDO.",
        "origem": "fallback",
    }
    try:
        resultado = analisar_foto(str(caminho), tipo=tipo, modelo=modelo)
        legenda = resultado.get("legenda_rdo") or resultado.get("descricao")
        if legenda:
            fallback["legenda_rdo"] = str(legenda).strip()
        fallback["descricao"] = str(resultado.get("descricao") or fallback["descricao"]).strip()
        fallback["origem"] = "gemini"
    except Exception as e:
        fallback["erro"] = str(e)
    return fallback


# ══════════════════════════════════════════════════════════
# 2. LEITURA DE PDF DE PROJETO
# ══════════════════════════════════════════════════════════

PROMPT_PDF_PERFIL = """Você é um engenheiro sanitarista lendo um perfil longitudinal de projeto de esgoto/água.

Extraia os dados da tabela do perfil longitudinal e retorne APENAS JSON válido:
{
  "pvs": [
    {
      "nome": "PV01",
      "estaca": "0+000",
      "cota_terreno": 5.20,
      "cota_fundo": 3.70,
      "profundidade": 1.50
    }
  ],
  "trechos": [
    {
      "pv_ini": "PV01",
      "pv_fim": "PV02",
      "dn_mm": 200,
      "extensao_m": 45.0,
      "declividade_perc": 0.85,
      "material": "PVC"
    }
  ],
  "rua": "nome da rua se visível",
  "nucleo": "nome do núcleo se visível"
}

Extraia TODOS os PVs e trechos visíveis. Se algum valor não for legível, coloque null.
"""


def ler_pdf_projeto(caminho_pdf, modelo=None):
    """
    Lê PDF de projeto (perfil longitudinal) usando Gemini.
    Extrai PVs, cotas, DNs, extensões → formato pvs + trechos.
    
    Args:
        caminho_pdf: caminho do PDF
        modelo: modelo (default: pro, melhor pra documentos)
    
    Returns:
        dict com pvs e trechos no formato ConstruData
    """
    client = _get_client()
    modelo = modelo or MODELO_PRO  # Pro é melhor pra documentos
    
    with open(caminho_pdf, "rb") as f:
        pdf_bytes = f.read()
    
    from google.genai import types
    
    response = client.models.generate_content(
        model=modelo,
        contents=[
            types.Part.from_bytes(data=pdf_bytes, mime_type="application/pdf"),
            types.Part.from_text(text=PROMPT_PDF_PERFIL),
        ],
        config=types.GenerateContentConfig(temperature=0.1),
    )
    
    text = response.text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else text[3:]
        if text.endswith("```"):
            text = text[:-3]
    
    try:
        dados = json.loads(text)
    except json.JSONDecodeError:
        return {"raw": text, "erro": "Resposta não é JSON válido"}
    
    # Converter para formato ConstruData (pvs dict + trechos list)
    pvs = {}
    for pv in dados.get("pvs", []):
        nome = pv.get("nome", "PV_?")
        pvs[nome] = {
            "x": 0, "y": 0,  # sem coordenadas (só perfil)
            "ct": pv.get("cota_terreno"),
            "cf": pv.get("cota_fundo"),
            "tipo": "esgoto",
            "estaca": pv.get("estaca"),
        }
    
    trechos = []
    for tr in dados.get("trechos", []):
        trechos.append({
            "pv_ini": tr.get("pv_ini"),
            "pv_fim": tr.get("pv_fim"),
            "dn_mm": tr.get("dn_mm"),
            "ext_m": tr.get("extensao_m"),
            "decl_mm": (tr.get("declividade_perc") or 0) * 10,  # % → ‰
            "material": tr.get("material", "PVC"),
            "tipo": "esgoto",
        })
    
    return {
        "pvs": pvs,
        "trechos": trechos,
        "rua": dados.get("rua"),
        "nucleo": dados.get("nucleo"),
        "n_pvs": len(pvs),
        "n_trechos": len(trechos),
        "fonte": "Gemini Vision (PDF)",
        "modelo": modelo,
    }


# ══════════════════════════════════════════════════════════
# 3. ASSISTENTE INTELIGENTE (consulta natural sobre dados)
# ══════════════════════════════════════════════════════════

def _build_context(pvs, trechos, dados_extra=None):
    """Constrói contexto resumido dos dados pra enviar ao Gemini."""
    ext_total = sum(t.get("ext_m", 0) for t in trechos)
    dns = {}
    for t in trechos:
        dn = t.get("dn_mm", 0)
        dns[dn] = dns.get(dn, 0) + t.get("ext_m", 0)
    
    ctx = f"""DADOS DA REDE (ConstruData HydroNetwork):
- PVs: {len(pvs)}
- Trechos: {len(trechos)}
- Extensão total: {ext_total:.0f}m
- DNs: {json.dumps({f'DN{k}': f'{v:.0f}m' for k,v in sorted(dns.items())})}
- Custo estimado: R$ {ext_total * 910:,.0f} (R$ 910/m)
- Materiais: PVC (esgoto), PEAD (água)
- Contrato: CT 11481051 SLNR Santos SABESP
- Empresa: FCN Construções e Saneamento

TRECHOS COM ALERTAS:
"""
    alertas = 0
    for t in trechos:
        v = t.get("v_ms", 0)
        tau = t.get("tau_pa", 0)
        if v > 5 or (0 < v < 0.6) or (0 < tau < 1):
            ctx += f"  {t.get('pv_ini','?')}→{t.get('pv_fim','?')}: V={v:.2f}m/s τ={tau:.1f}Pa DN{t.get('dn_mm',0)}\n"
            alertas += 1
            if alertas > 10:
                ctx += f"  ... +{sum(1 for t in trechos if t.get('v_ms',0)>5 or (0<t.get('tau_pa',0)<1)) - 10} mais\n"
                break
    
    if dados_extra:
        ctx += f"\nDADOS ADICIONAIS:\n{json.dumps(dados_extra, indent=2, ensure_ascii=False)[:2000]}"
    
    return ctx


def consultar(pergunta, pvs, trechos, dados_extra=None, modelo=None):
    """
    Faz pergunta em linguagem natural sobre os dados do projeto.
    
    Args:
        pergunta: "Qual o custo total?" ou "Quais trechos têm problema?"
        pvs: dict de PVs
        trechos: list de trechos
        dados_extra: dict com dados adicionais (execução, custos, etc.)
        modelo: modelo Gemini
    
    Returns:
        str com resposta
    """
    client = _get_client()
    modelo = modelo or MODELO_RAPIDO
    
    contexto = _build_context(pvs, trechos, dados_extra)
    
    prompt = f"""{contexto}

PERGUNTA DO ENGENHEIRO: {pergunta}

Responda de forma técnica, objetiva e em português brasileiro.
Use dados reais do projeto. Se calcular algo, mostre a conta.
Formate números no padrão brasileiro (R$ 1.234,56).
"""
    
    response = client.models.generate_content(
        model=modelo,
        contents=prompt,
        config={"temperature": 0.3},
    )
    
    return response.text


# ══════════════════════════════════════════════════════════
# 4. GERAÇÃO DE RELATÓRIO EXECUTIVO
# ══════════════════════════════════════════════════════════

def gerar_resumo_executivo(pvs, trechos, dados_exec=None, dados_custo=None, modelo=None):
    """
    Gera resumo executivo automático do projeto usando Gemini.
    Ideal para apresentação semanal / gerencial.
    """
    client = _get_client()
    modelo = modelo or MODELO_PRO
    
    contexto = _build_context(pvs, trechos, {
        "execucao": dados_exec[:5] if dados_exec else None,
        "custo": dados_custo,
    })
    
    prompt = f"""{contexto}

Gere um RESUMO EXECUTIVO profissional (máximo 300 palavras) para apresentar à gerência:

1. SITUAÇÃO ATUAL: metros executados, % do total, núcleos ativos
2. PRODUÇÃO: ritmo atual, comparação com meta
3. CUSTOS: estimativa de gasto vs orçamento
4. ALERTAS: problemas hidráulicos, restrições, riscos
5. PRÓXIMOS PASSOS: o que precisa acontecer na próxima semana

Formato: texto corrido profissional, sem markdown. Estilo direto e objetivo.
Empresa: FCN Construções e Saneamento. Contrato SABESP.
"""
    
    response = client.models.generate_content(
        model=modelo,
        contents=prompt,
        config={"temperature": 0.4},
    )
    
    return response.text


# ══════════════════════════════════════════════════════════
# 5. SETUP / CONFIGURAÇÃO
# ══════════════════════════════════════════════════════════

def setup_api_key(key=None):
    """
    Configura a API key do Gemini.
    Se não passar key, pede interativamente.
    """
    if not key:
        print("╔══════════════════════════════════════════════╗")
        print("║  CONFIGURAR GEMINI API                       ║")
        print("╠══════════════════════════════════════════════╣")
        print("║  1. Acesse: aistudio.google.com/app/apikey   ║")
        print("║  2. Crie uma API key (grátis)                ║")
        print("║  3. Cole aqui:                                ║")
        print("╚══════════════════════════════════════════════╝")
        key = input("API Key: ").strip()
    
    if not key:
        print("Nenhuma key fornecida.")
        return False
    
    # Salvar em config.json
    config_dir = Path.home() / ".construdata"
    config_dir.mkdir(exist_ok=True)
    config_path = config_dir / "config.json"
    
    config = {}
    if config_path.exists():
        try:
            config = json.loads(config_path.read_text())
        except:
            pass
    
    config["gemini_api_key"] = key
    config_path.write_text(json.dumps(config, indent=2))
    
    # Também setar no ambiente
    os.environ["GEMINI_API_KEY"] = key
    
    # Testar conexão
    try:
        client = _get_client()
        response = client.models.generate_content(
            model=MODELO_RAPIDO,
            contents="Responda apenas: OK",
        )
        if "OK" in response.text.upper():
            print(f"✅ Gemini conectado! Key salva em {config_path}")
            return True
        else:
            print(f"⚠️ Resposta inesperada: {response.text[:50]}")
            return True
    except Exception as e:
        print(f"❌ Erro ao conectar: {e}")
        return False


def verificar_conexao():
    """Verifica se o Gemini está configurado e acessível."""
    try:
        key = _get_api_key()
        if not key:
            return {"status": "SEM_KEY", "msg": "API key não configurada. Execute setup_api_key()"}
        
        client = _get_client()
        response = client.models.generate_content(
            model=MODELO_RAPIDO,
            contents="Responda apenas: CONECTADO",
        )
        return {"status": "OK", "msg": "Gemini conectado", "modelo": MODELO_RAPIDO}
    except ImportError:
        return {"status": "SEM_SDK", "msg": "pip install google-genai"}
    except Exception as e:
        return {"status": "ERRO", "msg": str(e)}


# ══════════════════════════════════════════════════════════
# CLI
# ══════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(description="ConstruData HydroNetwork — Gemini CLI")
    subparsers = parser.add_subparsers(dest="command", help="Comandos disponíveis")
    subparsers.add_parser("setup", help="Configurar API Key")
    subparsers.add_parser("status", help="Verificar conexão")
    
    analyze_parser = subparsers.add_parser("analyze", help="Analisar foto")
    analyze_parser.add_argument("path", help="Caminho da foto")
    analyze_parser.add_argument("--type", choices=["vala", "pv", "geral", "auto"], default="auto")

    ask_parser = subparsers.add_parser("ask", help="Perguntar sobre dados")
    ask_parser.add_argument("query", help="Sua pergunta")
    ask_parser.add_argument("--data", help="JSON com dados")

    args = parser.parse_args()

    if args.command == "setup":
        setup_api_key()
    elif args.command == "status":
        s = verificar_conexao()
        print(f"Status: {s['status']} | {s['msg']}")
    elif args.command == "analyze":
        res = analisar_foto(args.path, tipo=args.type)
        print(json.dumps(res, indent=2, ensure_ascii=False))
    elif args.command == "ask":
        pvs, trechos = {}, []
        if args.data and os.path.exists(args.data):
            with open(args.data, 'r') as f:
                d = json.load(f)
                pvs, trechos = d.get('pvs', {}), d.get('trechos', [])
        print(consultar(args.query, pvs, trechos))
    else:
        parser.print_help()

def main():
    parser = argparse.ArgumentParser(description="ConstruData HydroNetwork — Gemini CLI")
    subparsers = parser.add_subparsers(dest="command", help="Comandos disponíveis")

    subparsers.add_parser("setup", help="Configurar API Key do Gemini")
    subparsers.add_parser("status", help="Verificar conexão com Gemini")

    analyze_parser = subparsers.add_parser("analyze", help="Analisar foto de obra ou projeto")
    analyze_parser.add_argument("path", help="Caminho para a foto ou pasta")
    analyze_parser.add_argument("--type", choices=["vala", "pv", "geral", "auto"], default="auto")

    ask_parser = subparsers.add_parser("ask", help="Fazer pergunta técnica sobre dados")
    ask_parser.add_argument("query", help="Sua pergunta em linguagem natural")
    ask_parser.add_argument("--data", help="Caminho para arquivo JSON com dados (opcional)")

    args = parser.parse_args()

    if args.command == "setup":
        setup_api_key()
    elif args.command == "status":
        s = verificar_conexao()
        print(f"Status: {s['status']} | {s['msg']}")
    elif args.command == "analyze":
        p = Path(args.path)
        if p.is_dir():
            analisar_fotos_lote(args.path)
        else:
            res = analisar_foto(args.path, tipo=args.type)
            print(json.dumps(res, indent=2, ensure_ascii=False))
    elif args.command == "ask":
        pvs, trechos = {}, []
        if args.data and os.path.exists(args.data):
            with open(args.data, 'r') as f:
                d = json.load(f)
                pvs, trechos = d.get('pvs', {}), d.get('trechos', [])
        res = consultar(args.query, pvs, trechos)
        print(f"\n[Gemini]: {res}")
    else:
        parser.print_help()

if __name__ == "__main__":
    if len(sys.argv) > 1:
        main()
    else:
        print("╔══════════════════════════════════════════════════════════╗")
        print("║  ConstruData HydroNetwork — Gemini Integration          ║")
        print("╠══════════════════════════════════════════════════════════╣")
        print("║  Funcionalidades:                                        ║")
        print("║  1. analisar_foto(path)     → análise de foto de obra   ║")
        print("║  2. ler_pdf_projeto(path)   → extrai dados de PDF       ║")
        print("║  3. consultar(pergunta,...) → assistente inteligente     ║")
        print("║  4. gerar_resumo_executivo()→ relatório gerencial       ║")
        print("║  5. setup_api_key()         → configurar API            ║")
        print("╚══════════════════════════════════════════════════════════╝")
        
        # Verificar status
        status = verificar_conexao()
        print(f"\n  Status: {status['status']} — {status['msg']}")
        
        if status["status"] == "SEM_KEY":
            print("\n  Para configurar:")
            print("    python motor_gemini.py setup")
    
    if len(sys.argv) > 1 and sys.argv[1] == "setup":
        setup_api_key()
