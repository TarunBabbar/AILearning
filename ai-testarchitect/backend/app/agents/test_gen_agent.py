"""Test Generator agent — creates structured test cases from analyzed features."""
import json
from app.graph.state import AgentState, TestCaseItem
from app.ai import llm_complete, is_llm_available

TEST_GEN_PROMPT = """Generate thorough test cases from these features. For each feature, create test cases covering:
- Positive/happy path
- Negative/error scenarios
- Boundary conditions
- Integration points

Return as JSON array:
[
  {
    "title": "Test case title",
    "description": "What this tests",
    "steps": [{"step": 1, "action": "...", "expected": "..."}],
    "expected_result": "Overall expected outcome",
    "priority": "critical|high|medium|low",
    "test_type": "functional|regression|smoke|e2e|security|performance",
    "automation_status": "manual"
  }
]

Features to generate tests for:
"""


async def test_generator_node(state: AgentState) -> AgentState:
    features = state.get("test_plan", [])
    if not features:
        requirement = state.get("requirement_text", "") or state.get("user_message", "")
        features = [{"feature": "Requirement", "description": requirement}]

    if not is_llm_available():
        state["test_cases"] = _fallback_generate(state.get("user_message", ""))
        return state

    try:
        features_json = json.dumps(features, indent=2)
        raw = await llm_complete(TEST_GEN_PROMPT, features_json, max_tokens=3000)
        test_cases: list[TestCaseItem] = _parse_json(raw)
        state["test_cases"] = test_cases
    except Exception as e:
        state["errors"].append(f"Test Generator error: {e}")
        state["test_cases"] = _fallback_generate(state.get("user_message", ""))

    return state


def _fallback_generate(requirement: str) -> list[TestCaseItem]:
    msg = requirement.lower()
    tests: list[TestCaseItem] = []

    if "login" in msg or "auth" in msg:
        tests = [
            {"title": "Valid credentials login", "description": "User logs in with correct username and password", "steps": [{"step": 1, "action": "Navigate to login page", "expected": "Login form displayed"}, {"step": 2, "action": "Enter valid username and password", "expected": "Fields accept input"}, {"step": 3, "action": "Click login button", "expected": "User redirected to dashboard"}], "expected_result": "User successfully logged in and sees dashboard", "priority": "critical", "test_type": "functional", "automation_status": "manual"},
            {"title": "Invalid credentials login", "description": "User logs in with wrong password", "steps": [{"step": 1, "action": "Navigate to login page", "expected": "Login form displayed"}, {"step": 2, "action": "Enter valid username and wrong password", "expected": "Fields accept input"}, {"step": 3, "action": "Click login button", "expected": "Error message displayed"}], "expected_result": "Error message shown, user remains on login page", "priority": "high", "test_type": "functional", "automation_status": "manual"},
            {"title": "Empty fields login", "description": "User submits login form with empty fields", "steps": [{"step": 1, "action": "Navigate to login page", "expected": "Login form displayed"}, {"step": 2, "action": "Leave fields empty and click login", "expected": "Validation errors shown"}], "expected_result": "Validation messages for required fields", "priority": "medium", "test_type": "functional", "automation_status": "manual"},
            {"title": "Password reset flow", "description": "User requests password reset", "steps": [{"step": 1, "action": "Click 'Forgot password' link", "expected": "Reset form displayed"}, {"step": 2, "action": "Enter registered email", "expected": "Email accepted"}, {"step": 3, "action": "Check inbox for reset link", "expected": "Reset email received"}], "expected_result": "User receives password reset email", "priority": "high", "test_type": "e2e", "automation_status": "manual"},
            {"title": "Session expiry handling", "description": "User session expires after inactivity", "steps": [{"step": 1, "action": "Login and wait for session timeout", "expected": "Session expires"}, {"step": 2, "action": "Attempt action after expiry", "expected": "Redirected to login"}], "expected_result": "User redirected to login after session expires", "priority": "medium", "test_type": "security", "automation_status": "manual"},
        ]
    else:
        tests = [
            {"title": "Happy path scenario", "description": "Basic positive test", "steps": [{"step": 1, "action": "Perform main action", "expected": "Expected result occurs"}], "expected_result": "Feature works as expected", "priority": "high", "test_type": "functional", "automation_status": "manual"},
            {"title": "Error handling scenario", "description": "Error state test", "steps": [{"step": 1, "action": "Trigger error condition", "expected": "Error handled gracefully"}], "expected_result": "Appropriate error message displayed", "priority": "medium", "test_type": "functional", "automation_status": "manual"},
            {"title": "Boundary value test", "description": "Test boundary conditions", "steps": [{"step": 1, "action": "Test maximum input", "expected": "System handles gracefully"}], "expected_result": "No crash or data corruption", "priority": "low", "test_type": "functional", "automation_status": "manual"},
        ]

    return tests


def _parse_json(raw: str):
    try:
        if "```json" in raw:
            raw = raw.split("```json")[1].split("```")[0]
        elif "```" in raw:
            raw = raw.split("```")[1].split("```")[0]
        return json.loads(raw.strip())
    except (json.JSONDecodeError, IndexError):
        return []
