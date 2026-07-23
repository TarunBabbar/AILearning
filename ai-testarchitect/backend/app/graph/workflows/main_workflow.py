"""Main orchestration graph — wires all agents with conditional routing."""
from langgraph.graph import StateGraph, END
from app.graph.state import AgentState
from app.agents.orchestrator import orchestrator_node
from app.agents.jira_agent import jira_agent_node
from app.agents.prd_agent import prd_analyzer_node
from app.agents.test_gen_agent import test_generator_node
from app.agents.regression_agent import regression_selector_node
from app.agents.response_formatter import response_node


def _route_by_intent(state: AgentState) -> str:
    intent = state.get("intent", "chat")
    if intent == "generate_tests":
        return "jira_agent"
    elif intent == "regression_select":
        return "regression_selector"
    elif intent in ("execute", "migrate"):
        return "respond"
    return "respond"


def build_graph():
    workflow = StateGraph(AgentState)

    workflow.add_node("orchestrator", orchestrator_node)
    workflow.add_node("jira_agent", jira_agent_node)
    workflow.add_node("prd_analyzer", prd_analyzer_node)
    workflow.add_node("test_generator", test_generator_node)
    workflow.add_node("regression_selector", regression_selector_node)
    workflow.add_node("respond", response_node)

    workflow.set_entry_point("orchestrator")

    workflow.add_conditional_edges(
        "orchestrator",
        _route_by_intent,
        {
            "jira_agent": "jira_agent",
            "regression_selector": "regression_selector",
            "respond": "respond",
        },
    )

    workflow.add_edge("jira_agent", "prd_analyzer")
    workflow.add_edge("prd_analyzer", "test_generator")
    workflow.add_edge("test_generator", "respond")
    workflow.add_edge("regression_selector", "respond")
    workflow.add_edge("respond", END)

    return workflow.compile()


compiled_graph = build_graph()
