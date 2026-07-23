"""Orchestrator agent — intent classification and routing."""
from app.graph.state import AgentState
from app.ai import llm_complete, is_llm_available

ORCHESTRATOR_PROMPT = """You are an AI test architect orchestrator. Classify user intent into one of:
- generate_tests: User wants test cases generated from a PRD or requirement
- regression_select: User wants to identify regression tests for a bug/story
- execute: User wants to run/execute tests
- migrate: User wants to convert test frameworks (e.g., Java+Selenium to TS+Playwright)
- chat: General question or conversation

Reply with ONLY the intent string, nothing else."""


async def orchestrator_node(state: AgentState) -> AgentState:
    message = state.get("user_message", "")
    state["errors"] = []

    if not is_llm_available():
        return _fallback_classify(state, message)

    try:
        raw = await llm_complete(ORCHESTRATOR_PROMPT, message, max_tokens=50)
        intent = raw.strip().lower()
        valid = {"generate_tests", "regression_select", "execute", "migrate", "chat"}
        state["intent"] = intent if intent in valid else "chat"
    except Exception as e:
        state["errors"].append(f"Orchestrator error: {e}")
        _fallback_classify(state, message)

    return state


def _fallback_classify(state: AgentState, message: str) -> AgentState:
    msg = message.lower()
    if "generate" in msg and "test" in msg:
        state["intent"] = "generate_tests"
    elif "regression" in msg or "bug" in msg or "cover" in msg:
        state["intent"] = "regression_select"
    elif "run" in msg or "execute" in msg:
        state["intent"] = "execute"
    elif "migrate" in msg or "convert" in msg:
        state["intent"] = "migrate"
    else:
        state["intent"] = "chat"
    return state
