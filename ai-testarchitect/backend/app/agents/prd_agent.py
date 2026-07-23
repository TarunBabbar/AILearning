"""PRD Analyzer agent — extract features and acceptance criteria from requirements."""
import json
from app.graph.state import AgentState
from app.ai import llm_complete, is_llm_available

PRD_ANALYZE_PROMPT = """Analyze this requirement document and extract:
1. List of features/functionalities being described
2. For each feature: acceptance criteria, edge cases, and test scenarios

Return as JSON array:
[
  {
    "feature": "Feature name",
    "description": "Brief description",
    "acceptance_criteria": ["criterion 1", "criterion 2"],
    "edge_cases": ["edge case 1"],
    "test_scenarios": ["scenario 1", "scenario 2"]
  }
]

Requirement:
"""


async def prd_analyzer_node(state: AgentState) -> AgentState:
    requirement = state.get("requirement_text", "") or state.get("user_message", "")

    if not is_llm_available():
        return _fallback_analyze(state, requirement)

    try:
        raw = await llm_complete(PRD_ANALYZE_PROMPT, requirement, max_tokens=2000)
        state["test_plan"] = _parse_json_safe(raw)
    except Exception as e:
        state["errors"].append(f"PRD Analyzer error: {e}")
        state["test_plan"] = []

    return state


def _fallback_analyze(state: AgentState, requirement: str) -> AgentState:
    msg = requirement.lower()
    features = []

    if "login" in msg or "auth" in msg:
        features.append({
            "feature": "User Authentication",
            "description": "Login/logout functionality",
            "acceptance_criteria": [
                "User can login with valid credentials",
                "Invalid credentials show error message",
                "Session persists after login",
            ],
            "edge_cases": ["Expired session", "Concurrent logins", "SQL injection attempt"],
            "test_scenarios": [
                "Valid login",
                "Invalid password",
                "Empty fields",
                "Password reset",
                "Session timeout",
            ],
        })

    if "form" in msg or "register" in msg:
        features.append({
            "feature": "Form Validation",
            "description": "Input validation on forms",
            "acceptance_criteria": [
                "Required fields show validation errors",
                "Email format validated",
                "Password strength enforced",
            ],
            "edge_cases": ["XSS in inputs", "Very long inputs", "Unicode characters"],
            "test_scenarios": [
                "Submit with empty required fields",
                "Invalid email format",
                "Weak password rejected",
            ],
        })

    if not features:
        features.append({
            "feature": "General",
            "description": requirement[:200],
            "acceptance_criteria": ["Verify expected behavior"],
            "edge_cases": ["Error handling", "Edge inputs"],
            "test_scenarios": ["Happy path", "Error path", "Boundary test"],
        })

    state["test_plan"] = features
    return state


def _parse_json_safe(raw: str):
    try:
        if "```json" in raw:
            raw = raw.split("```json")[1].split("```")[0]
        elif "```" in raw:
            raw = raw.split("```")[1].split("```")[0]
        return json.loads(raw.strip())
    except (json.JSONDecodeError, IndexError):
        return []
