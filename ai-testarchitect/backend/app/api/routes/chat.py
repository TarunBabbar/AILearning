"""Chat SSE streaming endpoint — LangGraph-powered agent orchestration."""
import asyncio
from fastapi import APIRouter
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse
from app.graph.state import AgentState
from app.graph.workflows.main_workflow import compiled_graph

router = APIRouter(prefix="/api/chat", tags=["chat"])


class ChatRequest(BaseModel):
    message: str
    project_id: str | None = None
    conversation_id: str | None = None


@router.post("/stream")
async def chat_stream(request: ChatRequest):
    async def event_stream():
        state: AgentState = {
            "request_id": "req-001",
            "project_id": request.project_id or "",
            "conversation_id": request.conversation_id,
            "user_message": request.message,
            "status": "",
        }

        final = await compiled_graph.ainvoke(state)
        d = dict(final) if not isinstance(final, dict) else final
        response_text = d.get("response_text", "")

        if not response_text:
            response_text = "I couldn't process that. Try being more specific — mention a JIRA issue key or describe the feature you want tests for."

        for chunk in response_text:
            yield {"event": "message", "data": chunk}
            await asyncio.sleep(0.015)

    return EventSourceResponse(event_stream())
