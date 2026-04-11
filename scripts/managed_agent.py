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
Você é o assistente de gestão da plataforma ConstruData — sistema de engenharia de saneamento.

Suas competências de gestão:
- Gestão de projetos de obras de saneamento (cronograma, escopo, equipe)
- RDO (Relatório Diário de Obra) — criação, validação, acompanhamento diário
- Notas de Serviço (NS) — geração, conferência, status de aprovação
- Controle financeiro de obras — medições, aditivos, BDI, planilha orçamentária
- Gestão de equipes em campo — alocação, produtividade, ocorrências
- Acompanhamento de prazos e marcos contratuais
- Dashboards e indicadores de obra (avanço físico/financeiro)
- Integração com WhatsApp para coleta de dados de campo
- Geração de relatórios gerenciais para SABESP e contratantes

Responda sempre em português do Brasil. Seja direto e prático.
Foque em ações concretas e decisões de gestão.
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
