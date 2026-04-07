---
name: ce:sessions
description: "Search and ask questions about your coding agent session history across Claude Code, Codex, and Cursor. Use when asking what you worked on, what was tried before, how a problem was investigated across sessions, what happened recently, or any question about past agent sessions. Also use when the user references prior sessions, previous attempts, or past investigations — even without saying 'sessions' explicitly."
---

# /ce:sessions

Search your session history across Claude Code, Codex, and Cursor.

## Usage

```
/ce:sessions [question or topic]
/ce:sessions
```

## Execution

If no argument is provided, ask what the user wants to know about their session history. Use the platform's blocking question tool (`AskUserQuestion` in Claude Code, `request_user_input` in Codex, `ask_user` in Gemini). If no question tool is available, ask in plain text and wait for a reply.

Dispatch `compound-engineering:research:session-historian` with the user's question as the task prompt. Include the current working directory and git branch so the agent can scope its search. Omit the `mode` parameter so the user's configured permission settings apply.

Return the agent's response directly.
