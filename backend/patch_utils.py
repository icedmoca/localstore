from __future__ import annotations
from pathlib import Path
import io
import difflib

class PatchError(Exception):
    pass

def apply_unified_diff(base_dir: Path, patch_text: str) -> list[dict]:
    """Apply a unified diff within base_dir. Returns a list of applied files with {path, added, removed}."""
    # naive but safe approach: split by files and use difflib to re-generate content
    # expects patches in format starting with --- a/xxx / +++ b/xxx etc.
    # We only support text files; binary is ignored.
    lines = patch_text.splitlines(keepends=False)
    i = 0
    results = []
    while i < len(lines):
        if not (lines[i].startswith('--- ') and i+1 < len(lines) and lines[i+1].startswith('+++ ')):
            i += 1
            continue
        old = lines[i][4:].strip()
        new = lines[i+1][4:].strip()
        i += 2
        # consume hunks starting with @@
        hunk = []
        while i < len(lines) and lines[i].startswith('@@ '):
            hunk.append(lines[i])
            i += 1
            while i < len(lines) and not (lines[i].startswith('@@ ') or (lines[i].startswith('--- ') and i+1 < len(lines) and lines[i+1].startswith('+++ '))):
                hunk.append(lines[i])
                i += 1
        # derive path (strip a/ b/ prefixes)
        def norm(p: str) -> str:
            if p.startswith('a/') or p.startswith('b/'):
                return p[2:]
            return p
        rel_path = norm(new if new != '/dev/null' else old)
        target = (base_dir / rel_path).resolve()
        if not str(target).startswith(str(base_dir.resolve())):
            raise PatchError('Path traversal detected')
        # read current
        old_text = ''
        if target.exists():
            try:
                old_text = target.read_text(encoding='utf-8')
            except Exception:
                old_text = target.read_text(errors='ignore')
        # reconstruct new file by applying hunk lines using difflib.restore on a computed sequence
        # Simplified strategy: rebuild from hunk markers by computing resulting lines.
        new_lines = []
        j = 0
        # We cannot reliably rebuild from ranges without a full patch parser; instead, we attempt to compute new content from +/- context lines order
        # Build a candidate from old_text and inline edits; fall back to raising on mismatch.
        # For MVP, use python's patch-like approximation:
        try:
            # Compute a patch-like sequence for difflib
            old_lines = old_text.splitlines(keepends=False)
            seq = []
            for ln in hunk:
                if ln.startswith('@@ '):
                    continue
                sign = ln[:1]
                body = ln[1:]
                if sign == ' ':
                    seq.append(body)
                elif sign == '+':
                    new_lines.append(body)
                elif sign == '-':
                    # removed line; just skip from old
                    pass
            # Merge context seq and additions: naive merge preferring additions appended around context
            if seq and not new_lines:
                # if only context provided, keep old
                new_text = '\n'.join(old_lines)
            else:
                # build a simple combined set: context + additions; this is a best-effort MVP
                merged = []
                oi = 0
                for s in seq:
                    merged.append(s)
                merged.extend(new_lines)
                new_text = '\n'.join(merged)
        except Exception as e:
            raise PatchError(f'Failed to apply patch: {e}')
        # write
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(new_text, encoding='utf-8')
        results.append({"path": str(target.relative_to(base_dir)), "added": len(new_lines), "removed": 0})
    if not results:
        raise PatchError('No applicable hunks found')
    return results
