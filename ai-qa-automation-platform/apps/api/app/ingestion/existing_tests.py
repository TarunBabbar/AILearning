"""Existing-test ingestion — learn from what the user already has.

Two paths (spec §5):
  1. Repo auto-discovery: scan connected GitHub repo for tests/ spec/ e2e/
     folders, extract naming + assertion conventions, build coverage map.
  2. Manual upload: raw test file content imported as user-provided cases.

New AI-generated cases follow the learned conventions and are tagged
source: ai-generated — nothing is silently overwritten.
"""
from __future__ import annotations

import re
from typing import Any

from sqlalchemy.orm import Session

from ..db.models import TestCase

# Test file locations to auto-discover (spec §5.1).
TEST_DIR_HINTS = (
    "tests/", "test/", "spec/", "specs/", "e2e/", "e2e_tests/",
    "__tests__/", "cypress/", "playwright/",
)
TEST_FILE_RE = re.compile(
    r"(test|spec|e2e)[._-].*\.(py|js|ts|tsx|jsx)$|^.*[._-](test|spec)\.(py|js|ts|tsx|jsx)$",
    re.IGNORECASE,
)


def discover_test_files(repo_files: list[str]) -> list[str]:
    """Return files that look like tests given a repo file listing."""
    out = []
    for path in repo_files:
        if any(path.startswith(hint) for hint in TEST_DIR_HINTS) or TEST_FILE_RE.search(path):
            out.append(path)
    return out


def extract_conventions(test_contents: list[str]) -> dict[str, Any]:
    """Learn naming/assertion conventions from existing tests."""
    conventions: dict[str, Any] = {"assertion_style": "unknown", "naming": [], "framework": []}
    style_counts = {"assert": 0, "expect": 0, "should": 0}
    for content in test_contents:
        for kw in style_counts:
            if re.search(rf"\b{kw}\b", content):
                style_counts[kw] += 1
    if style_counts:
        conventions["assertion_style"] = max(style_counts, key=style_counts.get)
    # Heuristic framework detection
    for marker, framework in (
        ("@pytest", "pytest"),
        ("from playwright", "playwright"),
        ("describe(", "jest"),
        ("test(", "jest/vitest"),
        ("fixture(", "cypress"),
    ):
        if any(marker in c for c in test_contents):
            conventions["framework"].append(framework)
    return conventions


def import_uploaded_tests(
    db: Session, workspace_id: str, contents: list[str]
) -> int:
    """Import manually uploaded test content as user-provided cases."""
    count = 0
    for content in contents:
        title = _title_from_content(content)
        tc = TestCase(
            workspace_id=workspace_id,
            title=title,
            test_type=_detect_type(content),
            status="approved",
            source="user-provided",
            code=content,
        )
        db.add(tc)
        count += 1
    db.commit()
    return count


def _title_from_content(content: str) -> str:
    match = re.search(r"def test_(\w+)", content) or re.search(
        r"(?:it|test)\([\"']([^\"']+)", content
    )
    if match:
        return match.group(1).replace("_", " ").capitalize()
    return f"Imported test {abs(hash(content)) % 100000}"


def _detect_type(content: str) -> str:
    if "playwright" in content or "page." in content:
        return "ui"
    if "session" in content or "requests" in content or "httpx" in content:
        return "api"
    if "sqlalchemy" in content or "create_engine" in content:
        return "db"
    return "api"
