"""Response formatter — converts agent output to user-facing markdown."""
import json
from app.graph.state import AgentState


async def response_node(state: AgentState) -> AgentState:
    """Format test cases or other agent output into markdown for chat display."""
    intent = state.get("intent", "chat")

    if state.get("response_text"):
        # Already set by another agent (e.g., regression_selector)
        return state

    if intent == "generate_tests":
        state["response_text"] = _format_test_cases(state)
    elif intent in ("regression_select", "execute"):
        state["response_text"] = state.get("response_text", "Processing your request...")
    elif intent == "migrate":
        state["response_text"] = state.get("response_text", "Migration analysis in progress...")
    else:
        state["response_text"] = _format_help()

    state["status"] = "respond"
    return state


def _format_test_cases(state: AgentState) -> str:
    test_cases = state.get("test_cases", [])
    if not test_cases:
        return "No test cases were generated. Please provide more details about the requirement."

    lines = ["Here are the generated test cases:\n"]
    lines.append("| # | Title | Priority | Type |")
    lines.append("|---|---|---|---|")

    for i, tc in enumerate(test_cases, 1):
        title = tc.get("title", "Untitled")
        priority = tc.get("priority", "medium").title()
        tc_type = tc.get("test_type", "functional").title()
        lines.append(f"| TC-{i:03d} | {title} | {priority} | {tc_type} |")

    lines.append(f"\n**{len(test_cases)} test cases generated.**\n")

    # Add detail for first few
    for i, tc in enumerate(test_cases[:3], 1):
        steps = tc.get("steps", [])
        steps_text = "\n".join(
            f"  {s['step']}. {s.get('action', '')} → _{s.get('expected', '')}_"
            for s in steps
        ) if steps else "  No steps defined"

        lines.append(
            f"### TC-{i:03d}: {tc.get('title', 'Untitled')}\n"
            f"**Priority:** {tc.get('priority', 'medium').title()} | "
            f"**Type:** {tc.get('test_type', 'functional').title()}\n"
            f"{tc.get('description', '')}\n\n"
            f"**Steps:**\n{steps_text}\n\n"
            f"**Expected:** {tc.get('expected_result', 'N/A')}\n"
        )

    lines.append("\nThese test cases have been saved. View them in the **Tests** tab.")
    return "\n".join(lines)


def _format_help() -> str:
    return (
        "I'm QA Copilot — your AI test architect. I can help with:\n\n"
        "- **Generate test cases** from PRDs — try: *Generate test cases for PRD-123*\n"
        "- **Identify regression tests** for bugs — try: *What tests cover BUG-456?*\n"
        "- **Execute test automation** — try: *Run regression tests for BUG-789*\n"
        "- **Migrate test frameworks** — try: *Migrate LoginTest.java to Playwright*\n\n"
        "What would you like to do?"
    )
