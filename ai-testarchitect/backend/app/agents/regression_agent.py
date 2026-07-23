"""Regression Selector agent — identifies relevant tests for a bug/story."""
from app.graph.state import AgentState
from app.ai import llm_complete, is_llm_available

REGRESSION_PROMPT = """Given this bug/story, determine what types of regression tests are needed.
Identify categories of tests that should be verified. Categorize as manual or automatable.

Return as JSON:
{
  "analysis": "Brief impact analysis",
  "affected_areas": ["area1", "area2"],
  "recommended_tests": [
    {"title": "Test name", "reason": "Why this is relevant", "type": "manual|automated", "priority": "critical|high|medium|low"}
  ]
}

Bug/Story details:
"""


async def regression_selector_node(state: AgentState) -> AgentState:
    requirement = state.get("requirement_text", "") or state.get("user_message", "")

    if not is_llm_available():
        state["response_text"] = _fallback_regression(state)
        state["status"] = "respond"
        return state

    try:
        raw = await llm_complete(REGRESSION_PROMPT, requirement, max_tokens=1500)
        state["response_text"] = _format_regression_response(raw)
        state["status"] = "respond"
    except Exception as e:
        state["errors"].append(f"Regression Selector error: {e}")
        state["response_text"] = _fallback_regression(state)
        state["status"] = "respond"

    return state


def _fallback_regression(state: AgentState) -> str:
    return """Based on the bug analysis, here are the relevant regression tests:

**Recommended tests (ranked by relevance):**

1. **Happy path validation** — Verify basic flow still works (Automated) ⚡
2. **Related input validation** — Check inputs in affected area (Manual) ✍️
3. **Integration points** — Verify APIs/DB calls in affected module (Automated) ⚡
4. **Error handling** — Test error states in affected feature (Manual) ✍️
5. **Boundary conditions** — Edge case testing around the bug (Automated) ⚡

**Auto-runnable on PR:** Tests 1, 3, 5

Would you like me to execute the automated tests now?"""


def _format_regression_response(raw: str) -> str:
    import json
    try:
        if "```json" in raw:
            raw = raw.split("```json")[1].split("```")[0]
        elif "```" in raw:
            raw = raw.split("```")[1].split("```")[0]
        data = json.loads(raw)

        lines = [f"**Analysis:** {data.get('analysis', 'No analysis available')}\n"]
        if "affected_areas" in data:
            lines.append("**Affected Areas:** " + ", ".join(data["affected_areas"]) + "\n")

        lines.append("**Recommended Regression Tests:**\n")
        for i, test in enumerate(data.get("recommended_tests", []), 1):
            icon = "⚡" if test.get("type") == "automated" else "✍️"
            lines.append(
                f"{i}. **{test['title']}** — {test.get('reason', '')} ({test.get('type', 'manual').title()}) {icon}"
            )

        auto = [t["title"] for t in data.get("recommended_tests", []) if t.get("type") == "automated"]
        if auto:
            lines.append(f"\n**Auto-runnable on PR:** {', '.join(auto[:3])}")

        return "\n".join(lines)
    except (json.JSONDecodeError, KeyError):
        return raw
