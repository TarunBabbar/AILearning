"""JIRA Agent — fetch and parse JIRA issues."""
import httpx
from app.graph.state import AgentState, JiraIssue
from app.ai import llm_complete, is_llm_available

JIRA_EXTRACT_PROMPT = """Extract structured information from this JIRA issue content.
Return a JSON object with these fields (omit nulls):
- key: issue key
- summary: title/summary
- description: full description
- issue_type: Bug, Story, Task, Epic, or PRD
- acceptance_criteria: list of acceptance criteria (for stories/PRDs)
- steps_to_reproduce: list of steps (for bugs)
- expected_behavior: what should happen
- actual_behavior: what actually happens

JIRA Content:
"""


async def jira_agent_node(state: AgentState) -> AgentState:
    message = state.get("user_message", "")
    issue_key = _extract_issue_key(message)

    if not issue_key:
        state["status"] = "respond"
        return state

    # In Phase 2, parse JIRA key from message but don't actually call JIRA API yet
    # Real MCP integration comes later. For now, extract requirement text from what user provided.
    state["jira_issue"] = JiraIssue(
        key=issue_key,
        summary=f"Issue {issue_key}",
        description=message,
        issue_type="Story",
    )
    state["requirement_text"] = message
    return state


def _extract_issue_key(text: str) -> str | None:
    import re
    match = re.search(r'\b([A-Z]{2,10}-\d+)\b', text)
    return match.group(1) if match else None
