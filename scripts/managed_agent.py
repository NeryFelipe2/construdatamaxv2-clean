"""
Managed Agent — Assistente de Gestão ConstruData
Usa a API de Managed Agents da Anthropic para criar um agente interativo
focado em gestão de projetos de saneamento.

Uso:
    export ANTHROPIC_API_KEY="sua-chave"
    python scripts/managed_agent.py
"""

import os
import sys

from anthropic import Anthropic

SYSTEM_PROMPT = """\
Você é o assistente de gestão do Felipe Nery — Engenheiro Civil, fundador da FCN ConstruData HydroNetwork.

## REGRAS DE COMPORTAMENTO
- SEMPRE peça aprovação antes de executar qualquer ação
- Raciocine antes de agir — apresente opções e recomende
- Use dados reais, NUNCA invente ou mocke informações
- Responda sempre em PT-BR, direto, sem enrolação
- Não gaste tokens com explicações longas

## ⚠️ REGRA CRÍTICA — DOMÍNIOS ISOLADOS
Felipe tem DOIS papéis que NUNCA podem se misturar:

**DOMÍNIO 1 — RK Engenharia (empresa própria)**
Sócios: Felipe, Renato, Luiz
- Osasco CLU → Mateus (campo)
- Pardinho SES → Ícaro (campo)
- Obra no consórcio → Alexandre/Igor
- Medições jan-mar 2026, controle de máquinas

**DOMÍNIO 2 — Sala Técnica SLNR (emprego, gerente)**
- Sala Técnica → Gabriel, Vinicius
- Planejamento → Junior, Valdean, Veronica
- Produção → José Márcio
- Medição → Aline, Claudio
- Gerente Geral: Fabrizzio
- 1000 ligações, 455+ trechos, contrato SABESP 11481051

❌ NUNCA cruze dados entre RK e Sala Técnica.
✅ Única convergência: medição (tratada separadamente).

## PROJETOS ATIVOS
1. **SLNR Santos** — rede esgoto, medição mensal acumulada SABESP
2. **RK Engenharia** — Osasco CLU + Pardinho SES, subcontratada do consórcio
3. **DMAE 17670** — orçamento saneamento industrial Porto Alegre (SICRO+SINAPI+SABESP+ORSE+TCU)
4. **ConstruDataMax** — React+Vite (Vercel) + FastAPI + n8n (Railway) + WhatsApp bot
5. **Palantir** — Vite+React+TS, parceria

## REGRAS DE NEGÓCIO
- **Medição SABESP:** por ligação (não metro linear). NS é doc base. Fluxo: campo → RDO → topografia → sala técnica → NS (motor v5) → medição mensal → SLNR confere → SABESP aprova
- **Medição RK:** planilha SLNR, fluxo REV01 → REV02 → FINAL. Planilha chave: DEFESA_COMPLETA_RK_vs_SLNR.xlsx
- **DMAE:** BDI industrial (adm central 4-6%, seguro 1-2%, lucro 6-8%, ISS, PIS/COFINS 3.65%)
- **Dev:** credenciais APENAS em env vars, nunca hardcode

## COMANDOS QUE FELIPE USA
- "o que faço agora?" → prioridades e decisões pendentes
- "opções para [ASSUNTO]" → 3-4 opções com prós/contras
- "status medição [mês]" → consulta dados e mostra status
- "gerar RDO [obra]" → cria RDO com template
- "ajuda NS [núcleo]" → analisa dados e sugere ações
- "backlog ConstruDataMax" → lista pendências priorizadas
- "revisão semanal" → métricas da semana
"""


def main():
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("Erro: defina ANTHROPIC_API_KEY no ambiente.")
        print("  export ANTHROPIC_API_KEY='sk-ant-...'")
        sys.exit(1)

    client = Anthropic(api_key=api_key)

    print("Criando agente...")
    agent = client.beta.agents.create(
        name="ConstruData Gestao",
        model="claude-sonnet-4-6",
        system=SYSTEM_PROMPT,
        tools=[{"type": "agent_toolset_20260401"}],
    )
    print(f"  Agent ID: {agent.id}")

    print("Criando ambiente...")
    environment = client.beta.environments.create(
        name="construdata-env",
        config={"type": "cloud", "networking": {"type": "unrestricted"}},
    )
    print(f"  Environment ID: {environment.id}")

    print("Criando sessão...")
    session = client.beta.sessions.create(
        agent=agent.id,
        environment_id=environment.id,
        title="ConstruData - Gestao",
    )
    print(f"  Session ID: {session.id}")
    print()
    print("=" * 60)
    print("  Assistente de Gestao ConstruData")
    print("  Digite sua pergunta ou 'sair' para encerrar")
    print("=" * 60)
    print()

    while True:
        try:
            pergunta = input("Você: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nEncerrando.")
            break

        if not pergunta:
            continue
        if pergunta.lower() in ("sair", "exit", "quit"):
            print("Encerrando.")
            break

        with client.beta.sessions.events.stream(session.id) as stream:
            client.beta.sessions.events.send(
                session.id,
                events=[{
                    "type": "user.message",
                    "content": [{"type": "text", "text": pergunta}],
                }],
            )

            print("\nAgente: ", end="", flush=True)
            for event in stream:
                match event.type:
                    case "agent.message":
                        for block in event.content:
                            print(block.text, end="", flush=True)
                    case "agent.tool_use":
                        print(f"\n  [ferramenta: {event.name}]", end="", flush=True)
                    case "session.status_idle":
                        break

            print("\n")


if __name__ == "__main__":
    main()
