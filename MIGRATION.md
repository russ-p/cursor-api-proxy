# Migration Guide: v1.x → v2.0

This guide helps you migrate from v1.x to v2.0 of cursor-api-proxy.

## Overview

v2.0 is a **major breaking change** that replaces manual `agent` binary spawning with the official `@cursor/sdk` TypeScript SDK.

**Key Changes:**
- ✅ No longer requires installing the `agent` CLI
- ✅ Better Windows support (no cmd.exe limitations)
- ✅ Improved error handling with typed errors
- ✅ Automatic resource cleanup
- ❌ Removed features: mode selection, Max Mode, `login` command
- ❌ Breaking changes: all `CURSOR_AGENT_*` variables removed

## Breaking Changes

### 1. SDK-Based Execution

**v1.x:** Used manual `agent` binary spawning
**v2.0:** Uses `@cursor/sdk` for all agent execution

**Impact:**
- No longer requires installing the `agent` CLI
- All `agent` binary configuration variables are removed
- Better Windows support (no cmd.exe limitations)

**Migration:**
1. Install the new version: `npm install cursor-api-proxy@latest`
2. Set `CURSOR_API_KEY` instead of using `agent login`
3. Remove all `CURSOR_AGENT_*` environment variables
4. Remove `CURSOR_BRIDGE_USE_ACP` and related variables

### 2. Removed Features

The following features are **no longer supported**:

| Feature | Removed Variable | Alternative |
|---------|------------------|-------------|
| Mode selection | `CURSOR_BRIDGE_MODE`, `--mode` flag | Describe mode in prompt |
| Max Mode | `CURSOR_BRIDGE_MAX_MODE` | Not supported by SDK |
| Force flag | `CURSOR_BRIDGE_FORCE` | Not applicable with SDK |
| MCP approval | `CURSOR_BRIDGE_APPROVE_MCPS` | Handled by SDK automatically |
| Multi-account rotation | `CURSOR_CONFIG_DIRS`, `CURSOR_BRIDGE_MULTI_PORT` | Run multiple proxy instances with different API keys |
| `login` command | CLI subcommand | Set `CURSOR_API_KEY` directly |

### 3. Multi-Account Changes

**v1.x:** Used `CURSOR_CONFIG_DIRS` with different agent installations and `login` command
**v2.0:** Requires separate `CURSOR_API_KEY` for each account, running multiple proxy instances

If you need multi-account support, run multiple proxy instances with different `CURSOR_API_KEY` values on different ports:

```bash
# Terminal 1
export CURSOR_API_KEY="key1" && export CURSOR_BRIDGE_PORT=8765 && npm start

# Terminal 2
export CURSOR_API_KEY="key2" && export CURSOR_BRIDGE_PORT=8766 && npm start
```

## Environment Variable Migration

### Remove These Variables

```bash
# No longer needed
unset CURSOR_AGENT_BIN
unset CURSOR_CLI_BIN
unset CURSOR_CLI_PATH
unset CURSOR_AGENT_NODE
unset CURSOR_AGENT_SCRIPT
unset CURSOR_BRIDGE_USE_ACP
unset CURSOR_BRIDGE_ACP_SKIP_AUTHENTICATE
unset CURSOR_BRIDGE_ACP_RAW_DEBUG
unset CURSOR_BRIDGE_PROMPT_VIA_STDIN
unset CURSOR_BRIDGE_WIN_CMDLINE_MAX
unset CURSOR_BRIDGE_MAX_MODE
unset CURSOR_BRIDGE_FORCE
unset CURSOR_BRIDGE_APPROVE_MCPS
unset CURSOR_BRIDGE_MODE
unset CURSOR_CONFIG_DIRS
unset CURSOR_BRIDGE_MULTI_PORT
```

### Add This Variable

```bash
# Required (was optional before)
export CURSOR_API_KEY="cursor_..."
```

## Step-by-Step Migration

### Step 1: Get Your API Key

1. Visit [Cursor dashboard](https://cursor.com/dashboard/cloud-agents)
2. Navigate to Cloud Agents
3. Copy your API key (starts with `cursor_`)

### Step 2: Update Your Environment

**v1.x configuration:**
```bash
export CURSOR_AGENT_BIN="agent"
export CURSOR_BRIDGE_MODE="ask"
export CURSOR_BRIDGE_FORCE="false"
```

**v2.0 configuration:**
```bash
export CURSOR_API_KEY="cursor_..."
```

### Step 3: Update Your Application Code

**No changes required** for most use cases. The OpenAI-compatible API remains unchanged:

```javascript
// This still works
import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "http://127.0.0.1:8765/v1",
  apiKey: process.env.CURSOR_BRIDGE_API_KEY || "unused",
});

const completion = await client.chat.completions.create({
  model: "auto",
  messages: [{ role: "user", content: "Hello" }],
});
```

### Step 4: Update Prompts

If you were using mode selection:

**v1.x:**
```bash
npx cursor-api-proxy --mode agent
# or
curl -X POST http://127.0.0.1:8765/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "X-Cursor-Mode: agent" \
  -d '{"model":"auto","messages":[...]}'
```

**v2.0:**
```bash
# Describe the mode you want in the prompt
curl -X POST http://127.0.0.1:8765/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"auto","messages":[{"role":"user","content":"Please act as an agent that can modify files..."}]}'
```

### Step 5: Update Multi-Account Setup

**v1.x (login command):**
```bash
npx cursor-api-proxy login account1
npx cursor-api-proxy login account2
npx cursor-api-proxy start  # Auto-rotates between accounts
```

**v2.0 (multiple instances):**
```bash
# Terminal 1
export CURSOR_API_KEY="key1" && export CURSOR_BRIDGE_PORT=8765 && npm start

# Terminal 2
export CURSOR_API_KEY="key2" && export CURSOR_BRIDGE_PORT=8766 && npm start
```

## Testing Your Migration

1. Set `CURSOR_API_KEY`:
   ```bash
   export CURSOR_API_KEY="cursor_..."
   ```

2. Run the new proxy:
   ```bash
   npx cursor-api-proxy
   ```

3. Test models endpoint:
   ```bash
   curl http://127.0.0.1:8765/v1/models
   ```

4. Test chat completion:
   ```bash
   curl -X POST http://127.0.0.1:8765/v1/chat/completions \
     -H "Content-Type: application/json" \
     -d '{"model":"auto","messages":[{"role":"user","content":"Hello"}]}'
   ```

5. Test streaming:
   ```bash
   curl -N -X POST http://127.0.0.1:8765/v1/chat/completions \
     -H "Content-Type: application/json" \
     -d '{"model":"auto","messages":[{"role":"user","content":"Count to 5"}],"stream":true}'
   ```

6. Run integration tests (if working from source):
   ```bash
   npm run build
   npm start  # In another terminal
   node examples/test-sdk-integration.mjs
   ```

## Rollback

If you need to roll back to v1.x:

```bash
npm install cursor-api-proxy@1.0.1
# Set CURSOR_AGENT_BIN="agent" and install agent CLI
# Use your old environment variables
```

## Common Issues

### Issue: "CURSOR_API_KEY not configured"

**Cause:** The API key is now required.

**Solution:** Set `CURSOR_API_KEY` with your Cursor API key:
```bash
export CURSOR_API_KEY="cursor_..."
```

### Issue: "Agent not found" or "spawn ENOENT"

**Cause:** Trying to use v1.x configuration with v2.0 code.

**Solution:** Remove all `CURSOR_AGENT_*` variables and set `CURSOR_API_KEY` instead.

### Issue: Multi-account rotation not working

**Cause:** `CURSOR_CONFIG_DIRS` and `login` command are deprecated.

**Solution:** Run multiple proxy instances with different `CURSOR_API_KEY` values on different ports.

### Issue: Mode selection not working

**Cause:** `CURSOR_BRIDGE_MODE` and `--mode` flag are deprecated.

**Solution:** Describe the mode you want in the prompt instead.

### Issue: "Too long command line" on Windows

**Cause:** Using v1.x workarounds with v2.0.

**Solution:** v2.0 has native Windows support—no workarounds needed. Remove all Windows-specific configuration.

## Additional Resources

- SDK documentation: https://cursor.com/docs/api/sdk/typescript
- API documentation: See README.md
- Issue tracker: https://github.com/your-org/cursor-api-proxy/issues
- Examples: See `examples/` directory

## Summary Checklist

- [ ] Get `CURSOR_API_KEY` from Cursor dashboard
- [ ] Remove all `CURSOR_AGENT_*` environment variables
- [ ] Remove `CURSOR_BRIDGE_USE_ACP` and related variables
- [ ] Remove `CURSOR_BRIDGE_MODE` and use prompts instead
- [ ] Remove `CURSOR_CONFIG_DIRS` if using multi-account
- [ ] Test models endpoint
- [ ] Test chat completions (non-streaming)
- [ ] Test chat completions (streaming)
- [ ] Verify no deprecation warnings in logs
- [ ] Update any scripts/documentation that reference removed features

---

**Need help?** Please open an issue on GitHub with your specific use case.