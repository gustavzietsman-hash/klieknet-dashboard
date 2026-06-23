---
name: claude-code-launch
description: Launch Claude Code (CC) and navigate to your KliekNet project folders. Use this when starting work on klieknet-website, dashboard, event app, or any local project. Includes authentication, folder navigation, and troubleshooting steps.
---

# Claude Code Launch Guide

## Pre-Flight Checklist

Before you launch Claude Code, confirm:
- **API key is set**: `echo $ANTHROPIC_API_KEY` (should show `sk-ant-...`)
- **You're in the right folder**: `pwd` should show your project path
- **Claude Code is installed**: `claude --version`

---

## Step 1: Authenticate (First Time Only)

If you get `API Error: 401`:

```bash
claude login
```

Paste your API key from console.anthropic.com when prompted.

---

## Step 2: Navigate to Your Project

```bash
cd ~
ls -la | grep -i kliek
```

Common folders:
- `/Users/gustav/klieknet-website` — HTML/CSS/JS website
- `/Users/gustav/klieknet-dashboard` — Quote/event dashboard
- `/Users/gustav/celebrate` — Event/party app

Navigate:

```bash
cd /path/to/your/project
pwd
```

---

## Step 3: Launch Claude Code

```bash
claude
```

You should see your project directory in the welcome screen.

If wrong directory → `exit` and redo Step 2.

---

## Step 4: Set Your Model (Avoid Credit Drain)

If you see **"Usage credits required for 1M context"**:
/model
Pick **Sonnet 4.6 (default)**. Standard context only.

---

## Common Errors & Fixes

| Error | Fix |
|-------|-----|
| `API Error: 401` | Run `claude login` with your `sk-ant-...` key |
| `Usage credits required for 1M context` | Run `/model` and select standard context |
| Wrong directory in CC | Exit, navigate to correct folder, run `claude` again |
| `cd: no such file: /klieknet-dashboard` | Run `find ~ -name "*kliek*"` first |

---

## Quick Reference

```bash
# Find your project
cd ~ && ls -la | grep -i kliek

# Navigate and launch
cd /Users/gustav/your-project-name
claude

# Inside Claude Code
/model          # Switch model
/status         # Check settings
exit            # Exit CC
```
