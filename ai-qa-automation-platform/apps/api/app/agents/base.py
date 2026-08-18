"""Agent framework: shared interface for all STLC agents.

Every agent is a class with a run() method: takes a workspace-scoped context
(connector tools + data), calls the swappable LLM (app/llm/client.py), and
returns structured output. The Supervisor routes work between them.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any

from ..llm.client import complete_json


@dataclass
class AgentContext:
    """Workspace-scoped context handed to every agent."""

    workspace_id: str
    run_id: str | None = None
    data: dict[str, Any] = field(default_factory=dict)
    # MCP tool descriptors available to this agent (name -> callable)
    tools: dict[str, Any] = field(default_factory=dict)


@dataclass
class AgentResult:
    agent: str
    status: str = "success"  # success|retry|escalate
    output: dict[str, Any] = field(default_factory=dict)
    error: str | None = None


class BaseAgent(ABC):
    """Common contract: name, prompt, structured output schema, run()."""

    name: str = "base"
    description: str = ""
    output_schema: str = ""  # JSON schema description for the model

    def __init__(self, model: str | None = None):
        self.model = model

    @abstractmethod
    def build_prompt(self, ctx: AgentContext) -> str:
        ...

    def system_prompt(self) -> str:
        return self._system_prompt().format(
            name=self.name,
            description=self.description,
            output_schema=self.output_schema,
        )

    def _system_prompt(self) -> str:
        return (
            "You are {name}.\n{description}\n"
            "Always respond with valid JSON matching:\n{output_schema}"
        )

    def run(self, ctx: AgentContext) -> AgentResult:
        """Execute the agent. Subclasses override to wire MCP tools."""
        try:
            prompt = self.build_prompt(ctx)
            output = complete_json(prompt, system=self.system_prompt(), model=self.model)
            return AgentResult(agent=self.name, output=output)
        except Exception as exc:  # noqa: BLE001 — agent failure → supervisor decides
            return AgentResult(
                agent=self.name, status="retry", error=str(exc)
            )
