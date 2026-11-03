#!/usr/bin/env python3
from pathlib import Path

path = Path("/mnt/c/Users/ramit/Downloads/MEMORY KINGDOM Master Build Prompt v3.pdf")
try:
    from pypdf import PdfReader

    r = PdfReader(str(path))
except Exception:
    try:
        import PyPDF2

        r = PyPDF2.PdfReader(open(path, "rb"))
    except Exception as e:
        raise SystemExit(f"No PDF library: {e}")

parts = []
for i, page in enumerate(r.pages):
    t = page.extract_text() or ""
    parts.append(f"\n===== PAGE {i + 1} =====\n{t}")
out = "".join(parts)
Path("/tmp/mk-prompt-v3.txt").write_text(out, encoding="utf-8")
print("pages", len(r.pages), "chars", len(out))
