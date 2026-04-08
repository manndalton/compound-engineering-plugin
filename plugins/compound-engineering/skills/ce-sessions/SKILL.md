---
name: ce:sessions
description: "Search and ask questions about your coding agent session history. Use when asking what you worked on, what was tried before, how a problem was investigated across sessions, what happened recently, or any question about past agent sessions. Also use when the user references prior sessions, previous attempts, or past investigations — even without saying 'sessions' explicitly."
---

# /ce:sessions

Search your session history.

## Usage

```
/ce:sessions [question or topic]
/ce:sessions
```

## Execution

If no argument is provided, ask what the user wants to know about their session history. Use the platform's blocking question tool (`AskUserQuestion` in Claude Code, `request_user_input` in Codex, `ask_user` in Gemini). If no question tool is available, ask in plain text and wait for a reply.

Dispatch `compound-engineering:research:session-historian` with the user's question as the task prompt. Include the current working directory, git branch, and which platform this session is running on so the agent can scope its search. Omit the `mode` parameter so the user's configured permission settings apply.

**Platform scoping:** By default, restrict the search to the current platform's session history only (e.g., Claude Code sessions when running in Claude Code). If the user explicitly asks about other platforms or cross-platform history, pass that through and let the agent widen.

Return the agent's response directly.
