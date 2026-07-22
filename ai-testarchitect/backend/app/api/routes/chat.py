"""Chat SSE streaming endpoint."""
import asyncio
import json
from fastapi import APIRouter
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

router = APIRouter(prefix="/api/chat", tags=["chat"])


class ChatRequest(BaseModel):
    message: str
    project_id: str | None = None
    conversation_id: str | None = None


async def mock_agent_response(message: str) -> str:
    """Simulate an agent response. Replace with LangGraph orchestrator later."""
    msg_lower = message.lower()

    if "generate" in msg_lower and "test" in msg_lower:
        return (
            "Here are the generated test cases:\n\n"
            "| ID | Title | Priority | Type |\n"
            "|---|---|---|---|\n"
            "| TC-001 | User login with valid credentials | High | Functional |\n"
            "| TC-002 | User login with invalid password | High | Functional |\n"
            "| TC-003 | Password reset flow | Medium | Functional |\n"
            "| TC-004 | Login with expired session | Medium | Security |\n"
            "| TC-005 | Concurrent login attempts | Low | Performance |\n\n"
            "These test cases have been saved to the project. You can view them in the **Tests** tab."
        )

    if "regression" in msg_lower or "bug" in msg_lower:
        return (
            "Based on BUG-456 analysis, here are the relevant regression tests:\n\n"
            "**Recommended tests (ranked by relevance):**\n\n"
            "1. **TC-012** — Account creation with duplicate email (Automated) ⚡\n"
            "2. **TC-015** — Form validation edge cases (Manual) ✍️\n"
            "3. **TC-003** — Password reset flow (Automated) ⚡\n"
            "4. **TC-008** — Session expiry handling (Manual) ✍️\n"
            "5. **TC-021** — CSRF token validation (Automated) ⚡\n\n"
            "**Auto-runnable on PR:** TC-012, TC-003, TC-021\n\n"
            "Would you like me to execute the automated tests now?"
        )

    if "migrate" in msg_lower or "convert" in msg_lower:
        return (
            "Migration analysis complete. Here's the converted test:\n\n"
            "```typescript\n"
            "import { test, expect } from '@playwright/test';\n\n"
            "test('user can login with valid credentials', async ({ page }) => {\n"
            "  await page.goto('https://example.com/login');\n"
            "  await page.locator('#username').fill('testuser');\n"
            "  await page.locator('#password').fill('password123');\n"
            "  await page.locator('button[type=\"submit\"]').click();\n"
            "  await expect(page.locator('.welcome-message')).toBeVisible();\n"
            "});\n"
            "```\n\n"
            "**Changes made:**\n"
            "- `WebDriver` → `chromium.launch()` + `page`\n"
            "- `findElement(By.id())` → `locator('#...')`\n"
            "- `@Test` → `test()`\n"
            "- `Assert.assertEquals()` → `expect().toBe()`\n\n"
            "Download the full file or apply it to your project."
        )

    return (
        "I'm QA Copilot — your AI test architect. I can help with:\n\n"
        "- **Generate test cases** from PRDs — try: *Generate test cases for PRD-123*\n"
        "- **Identify regression tests** for bugs — try: *What tests cover BUG-456?*\n"
        "- **Execute test automation** — try: *Run regression tests for BUG-789*\n"
        "- **Migrate test frameworks** — try: *Migrate LoginTest.java to Playwright*\n\n"
        "What would you like to do?"
    )


@router.post("/stream")
async def chat_stream(request: ChatRequest):
    async def event_stream():
        response_text = await mock_agent_response(request.message)
        for chunk in response_text:
            yield {"event": "message", "data": chunk}
            await asyncio.sleep(0.015)

    return EventSourceResponse(event_stream())
