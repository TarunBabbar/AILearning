"""Small shared utilities."""
import json


def parse_json(raw: str) -> dict:
    """Parse model JSON, tolerating code-fence wrapping."""
    s = raw.strip()
    if s.startswith("```"):
        s = s.split("\n", 1)[-1]
        s = s.rsplit("```", 1)[0].strip()
    start, end = s.find("{"), s.rfind("}")
    if start == -1 or end == -1:
        raise ValueError(f"Model returned non-JSON: {raw[:300]}")
    try:
        return json.loads(s[start : end + 1])
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid JSON from model: {raw[:300]}") from exc
