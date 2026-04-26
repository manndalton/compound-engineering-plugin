#!/usr/bin/env python3
"""Validate ce-compound docs/solutions/ frontmatter for parser-safety issues.

Usage:
    python3 validate-frontmatter.py <doc-path>

Exit codes:
    0 — frontmatter passes all checks
    1 — validation failure (diagnostics on stderr)
    2 — usage error (bad arguments, missing file)

Scope: this script catches *parser-safety* issues — frontmatter that strict
YAML parsers will silently misread. It does NOT validate against the
schema's required-field or enum-value rules; that's a separate concern. The
intent is to prevent the silent-data-loss bug class where YAML's quoting
rules truncate or reframe scalar values without raising.

Checks (regex-based, no YAML parser dependency):
    1. File starts with `---\\n` and has a closing `---`
    2. No top-level scalar value contains ` #` unquoted (silent comment
       truncation — what Codex caught on PR #695)
    3. No top-level scalar value contains `: ` unquoted (mapping confusion)
    4. No top-level scalar value starts unquoted with a YAML reserved
       indicator (`-`, `` ` ``, `*`, `&`, `!`, `|`, `>`, `%`, `@`, `?`)

Pure-stdlib (no PyYAML or other third-party deps). Runs in <50ms typical.
Designed to produce concrete, actionable error messages so the calling
agent can fix and retry without ambiguity.
"""
import os
import re
import sys


def usage_fail(msg: str) -> "NoReturn":
    sys.stderr.write(f"validate-frontmatter: {msg}\n")
    sys.exit(2)


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        usage_fail(f"usage: {os.path.basename(argv[0])} <doc-path>")

    doc_path = argv[1]
    if not os.path.isfile(doc_path):
        usage_fail(f"file not found: {doc_path}")

    with open(doc_path) as f:
        text = f.read()

    issues: list[str] = []

    # Check 1: frontmatter delimiters
    if not text.startswith("---\n"):
        sys.stderr.write(
            f"FAIL: {doc_path}\n"
            f"  file does not start with '---' frontmatter delimiter\n"
        )
        return 1

    end = text.find("\n---", 4)
    if end < 0:
        sys.stderr.write(
            f"FAIL: {doc_path}\n"
            f"  frontmatter not closed (missing terminating '---')\n"
        )
        return 1

    fm_text = text[4:end]

    # Checks 2, 3, 4: scalar quoting risks on top-level scalar fields.
    # We scan line-by-line and only flag top-level mapping entries
    # (no leading whitespace) whose value isn't already quoted/structured.
    for lineno, line in enumerate(fm_text.split("\n"), start=2):
        stripped = line.lstrip()
        if not stripped or stripped.startswith("#"):
            continue
        if ":" not in line:
            continue
        # Top-level mapping keys only — skip nested values, array items
        if line.startswith((" ", "\t")):
            continue
        # Skip pure list-marker lines like "- item" (these can't be top-level
        # in our frontmatter convention, but be defensive)
        if stripped.startswith("- "):
            continue

        key, _, val = line.partition(":")
        val_stripped = val.strip()
        if not val_stripped:
            # Key with no value on this line — likely a parent of a nested
            # block (`tags:` followed by `- foo`). Nothing to validate here.
            continue
        # Already quoted or structured (block scalar, flow collection)
        if val_stripped[0] in '"\'[{|>':
            continue

        if re.search(r"\s#", val_stripped):
            issues.append(
                f"line {lineno}: '{key.strip()}' value contains ' #' — quote it. "
                "YAML treats space-then-# as a comment delimiter and silently "
                "drops the rest of the value."
            )
        if re.search(r":\s", val_stripped):
            issues.append(
                f"line {lineno}: '{key.strip()}' value contains ': ' — quote it. "
                "Strict YAML parsers may treat this as a nested mapping."
            )
        if val_stripped[0] == "-":
            issues.append(
                f"line {lineno}: '{key.strip()}' value starts with '-' — quote it. "
                "Bare '-' reads as a list marker."
            )
        if val_stripped[0] in ("`", "*", "&", "!", "|", ">", "%", "@", "?"):
            issues.append(
                f"line {lineno}: '{key.strip()}' value starts with reserved "
                f"indicator '{val_stripped[0]}' — quote it."
            )

    if issues:
        sys.stderr.write(f"FAIL: {doc_path}\n")
        for issue in issues:
            sys.stderr.write(f"  {issue}\n")
        return 1

    print(f"OK: {doc_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
