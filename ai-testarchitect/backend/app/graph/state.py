"""LangGraph shared state schema."""
from typing import Literal, Optional, Any
from typing_extensions import TypedDict


class JiraIssue(TypedDict, total=False):
    key: str
    summary: str
    description: str
    issue_type: str
    status: str
    comments: list[str]
    linked_prd: Optional[str]


class TestPlanItem(TypedDict, total=False):
    feature: str
    scenario: str
    acceptance_criteria: list[str]


class TestCaseItem(TypedDict, total=False):
    title: str
    description: str
    steps: list[dict]
    expected_result: str
    priority: str
    test_type: str
    automation_status: str


class AgentState(TypedDict, total=False):
    request_id: str
    project_id: str
    conversation_id: Optional[str]
    user_message: str
    intent: Literal["generate_tests", "regression_select", "execute", "migrate", "chat"]
    jira_issue: Optional[JiraIssue]
    requirement_text: str
    test_plan: list[TestPlanItem]
    test_cases: list[TestCaseItem]
    source_code: Optional[str]
    target_framework: Optional[str]
    response_text: str
    errors: list[str]
    status: str
