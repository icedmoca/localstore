from __future__ import annotations
import os
from pathlib import Path

def home_dir() -> Path:
    # Cross-platform home
    return Path(os.path.expanduser('~'))

def dev_root() -> Path:
    return home_dir() / '.localstore' / 'workspaces'

def tool_workspace(tool_id: str) -> Path:
    return dev_root() / tool_id
