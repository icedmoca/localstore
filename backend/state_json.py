from __future__ import annotations
import json, os, tempfile
from pathlib import Path
from typing import Dict, Any

class AtomicJSONState:
    def __init__(self, path: Path):
        self.path = path
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.data: Dict[str, Any] = {"installed": {}}
        if self.path.exists():
            try:
                self.data = json.loads(self.path.read_text(encoding="utf-8"))
            except Exception:
                pass

    def save(self) -> None:
        tmp_fd, tmp_path = tempfile.mkstemp(dir=str(self.path.parent))
        try:
            with os.fdopen(tmp_fd, "w", encoding="utf-8") as f:
                json.dump(self.data, f, indent=2)
            os.replace(tmp_path, self.path)
        except Exception:
            try: os.remove(tmp_path)
            except Exception: pass
            raise

    def list_installed(self):
        return list(self.data.get("installed", {}).values())

    def get(self, tool_id: str):
        return self.data.get("installed", {}).get(tool_id)

    def upsert(self, tool: Dict[str, Any]):
        self.data.setdefault("installed", {})[tool["id"]] = tool
        self.save()

    def remove(self, tool_id: str):
        self.data.get("installed", {}).pop(tool_id, None)
        self.save()
