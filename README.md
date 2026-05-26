# cursor-api-proxy

OpenAI-compatible proxy for Cursor AI. Expose Cursor models on localhost so any LLM client (OpenAI SDK, LiteLLM, LangChain, etc.) can call them as a standard chat API.

This package works as **one npm dependency**: use it as an **SDK** in your app to call the proxy API, and/or run the **CLI** to start the proxy server. Core behavior is unchanged.

**OpenAI-compatible mode is not the Cursor IDE:** the HTTP API does not automatically attach your repo, `@codebase`, or host shell the way the desktop app does. See [Local workspace and agent frameworks](#local-workspace-and-agent-frameworks).

## Prerequisites (required for the proxy to work)

- **Node.js** 18+
- **Cursor API key** from the [Cursor dashboard](https://cursor.com/dashboard/cloud-agents)

  ```bash
  export CURSOR_API_KEY="cursor_..."
  ```

  Get your API key from the Cursor Cloud Agents section of your dashboard.

## Install

**From npm (use as SDK in another project):**

```bash
npm install cursor-api-proxy
export CURSOR_API_KEY="cursor_..."
npx cursor-api-proxy
```

**From source (develop or run CLI locally):**

```bash
git clone <this-repo>
cd cursor-api-proxy
npm install
export CURSOR_API_KEY="cursor_..."
npm run build
npm start
```

## Run the proxy (CLI)

Start the server so the API is available (e.g. for the SDK or any HTTP client):

```bash
export CURSOR_API_KEY="cursor_..."
npx cursor-api-proxy
# or from repo: npm start / node dist/cli.js
```

To expose on your network (e.g. Tailscale):

```bash
export CURSOR_API_KEY="cursor_..."
npx cursor-api-proxy --tailscale
```

By default the server listens on **http://127.0.0.1:8765**. Optionally set `CURSOR_BRIDGE_API_KEY` to require `Authorization: Bearer <key>` on requests.

## Run with Docker

### Build and run with Docker

```bash
# Build the image
docker build -t cursor-api-proxy .

# Run the container
docker run -d \
  --name cursor-api-proxy \
  -p 8765:8765 \
  -e CURSOR_API_KEY=your-cursor-api-key \
  cursor-api-proxy
```

### Build and run with Docker Compose

```bash
# Create data directory for sessions log
mkdir -p data/sessions

# Create .env file for configuration (optional)
cat > .env << EOF
CURSOR_BRIDGE_PORT=8765
CURSOR_BRIDGE_API_KEY=your-secret-key
CURSOR_API_KEY=your-cursor-api-key
CURSOR_BRIDGE_VERBOSE=false
EOF

# Build and start
docker-compose up -d

# View logs
docker-compose logs -f
```

**Note:** When running in Docker, you must set `CURSOR_API_KEY` for authentication.

### HTTPS with Tailscale (MagicDNS)

To serve over HTTPS so browsers and clients trust the connection (e.g. `https://macbook.tail4048eb.ts.net:8765`):

1. **Generate Tailscale certificates** on this machine (run from the project directory or where you want the cert files):

   ```bash
   sudo tailscale cert macbook.tail4048eb.ts.net
   ```

   This creates `macbook.tail4048eb.ts.net.crt` and `macbook.tail4048eb.ts.net.key` in the current directory.

2. **Run the proxy with TLS** and optional Tailscale bind:

   ```bash
   export CURSOR_BRIDGE_API_KEY=your-secret
   export CURSOR_BRIDGE_TLS_CERT=/path/to/macbook.tail4048eb.ts.net.crt
   export CURSOR_BRIDGE_TLS_KEY=/path/to/macbook.tail4048eb.ts.net.key
   # Bind to Tailscale IP so the service is only on the tailnet (optional):
   export CURSOR_BRIDGE_HOST=100.123.47.103
   npm start
   ```

   Or bind to all interfaces and use HTTPS:

   ```bash
   CURSOR_BRIDGE_TLS_CERT=./macbook.tail4048eb.ts.net.crt \
   CURSOR_BRIDGE_TLS_KEY=./macbook.tail4048eb.ts.net.key \
   CURSOR_BRIDGE_API_KEY=your-secret \
   npm start -- --tailscale
   ```

3. **Access the API** from any device on your tailnet:
   - Base URL: `https://macbook.tail4048eb.ts.net:8765/v1` (use your MagicDNS name and port)
   - Browsers will show a padlock; no certificate warnings when using Tailscale-issued certs.

## Local workspace and agent frameworks

When you point an agent runtime (OpenClaw, LangChain, a custom harness, etc.) at this proxy with a normal `baseUrl` + `apiKey`, you get a **cloud model behind an OpenAI-shaped HTTP API**. That is **not** the same product surface as the **Cursor IDE**, which can index and act on a local workspace.

- **No implicit project context:** The model only sees what you put in the request—`messages`, optional tools schema, and **tool results that your client executes and sends back**. There is no automatic filesystem, repo layout, or `@codebase` injection from the proxy alone.
- **If "local" actions work, they work in the client:** Reads, shell commands, and directory listings happen only when **your agent framework** implements tools and runs them on the host, then returns outputs in follow-up messages. The proxy does not substitute for that.
- **Server-side workspace (optional):** The Cursor agent may run with a workspace directory (`CURSOR_BRIDGE_WORKSPACE`, per-request `X-Cursor-Workspace`). By default, `CURSOR_BRIDGE_CHAT_ONLY_WORKSPACE=true` runs the agent in an **empty temp directory** so it does not read or write your real project; the proxy also overrides `HOME`, `USERPROFILE`, and `CURSOR_CONFIG_DIR` so the agent does not load global or project rules from elsewhere. Set it to `false` if you intentionally want the agent to see a path on the machine where the proxy runs (still not the same as IDE indexing—see env table below).
- **Recommended patterns for agents:** Use **client-side tools** (e.g. `read_file`, `run_terminal_cmd`) and pass results as tool messages; add **RAG** or retrieval and inject snippets into `user` content; or paste relevant files into the prompt. There is no built-in "sync entire workspace through the proxy" today; if that changes, it will be documented here.

## Use as SDK in another project

Install the package and set `CURSOR_API_KEY`. When you use the SDK with the default URL, **the proxy starts in the background automatically** if it is not already running. You can still start it yourself with `npx cursor-api-proxy` or set `CURSOR_PROXY_URL` to point at an existing proxy (then the SDK will not start another).

- **Base URL**: `http://127.0.0.1:8765/v1` (override with `CURSOR_PROXY_URL` or options).
- **API key**: Use any value (e.g. `unused`), or set `CURSOR_BRIDGE_API_KEY` and pass it in options or env.
- **Disable auto-start**: Pass `startProxy: false` (or use a custom `baseUrl`) if you run the proxy yourself and don't want the SDK to start it.
- **Shutdown behavior**: When the SDK starts the proxy, it also stops it automatically when the Node.js process exits or receives normal termination signals. `stopManagedProxy()` is still available if you want to shut it down earlier. `SIGKILL` cannot be intercepted.

### Option A: OpenAI SDK + helper (recommended)

This is an optional consumer-side example. `openai` is not a dependency of `cursor-api-proxy`; install it only in the app where you want to use this example.

```js
import OpenAI from "openai";
import { getOpenAIOptionsAsync } from "cursor-api-proxy";

const opts = await getOpenAIOptionsAsync(); // starts proxy if needed
const client = new OpenAI(opts);

const completion = await client.chat.completions.create({
  model: "gpt-5.2",
  messages: [{ role: "user", content: "Hello" }],
});
console.log(completion.choices[0].message.content);
```

For a sync config without auto-start, use `getOpenAIOptions()` and ensure the proxy is already running.

### Option B: Minimal client (no OpenAI SDK)

```js
import { createCursorProxyClient } from "cursor-api-proxy";

const proxy = createCursorProxyClient(); // proxy starts on first request if needed
const data = await proxy.chatCompletionsCreate({
  model: "auto",
  messages: [{ role: "user", content: "Hello" }],
});
console.log(data.choices?.[0]?.message?.content);
```

### Option C: Raw OpenAI client (no SDK import from this package)

```js
import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "http://127.0.0.1:8765/v1",
  apiKey: process.env.CURSOR_BRIDGE_API_KEY || "unused",
});
// Start the proxy yourself (npx cursor-api-proxy) or use Option A/B for auto-start.
```

### Endpoints

| Method | Path                   | Description                                                           |
| ------ | ---------------------- | --------------------------------------------------------------------- |
| GET    | `/health`              | Server and config info                                                |
| GET    | `/v1/models`           | List Cursor models                                                    |
| POST   | `/v1/chat/completions` | Chat completion (OpenAI shape; supports `stream: true`)               |
| POST   | `/v1/messages`         | Anthropic Messages API (used by Claude Code; supports `stream: true`) |

**Usage / token fields:** Responses may include `usage` with `prompt_tokens`, `completion_tokens`, and `total_tokens`. These are **heuristic estimates** (character count ÷ 4), not Cursor billing meters. Do not use them for invoicing.

## Environment variables

Environment handling is centralized in one module. Aliases, defaults, path resolution, platform fallbacks, and `--tailscale` host behavior are resolved consistently before the server starts.

| Variable | Default | Description |
|----------|---------|-------------|
| `CURSOR_BRIDGE_HOST` | `127.0.0.1` | Bind address |
| `CURSOR_BRIDGE_PORT` | `8765` | Port |
| `CURSOR_BRIDGE_API_KEY` | — | If set, require `Authorization: Bearer <key>` on requests |
| `CURSOR_API_KEY` / `CURSOR_AUTH_TOKEN` | — | **Required.** Cursor API key for authentication. Get it from [Cursor dashboard](https://cursor.com/dashboard/cloud-agents). |
| `CURSOR_BRIDGE_WORKSPACE` | process cwd | Base workspace directory for Cursor agent. With `CURSOR_BRIDGE_CHAT_ONLY_WORKSPACE=false`, header `X-Cursor-Workspace` must point to an **existing directory under this path** (after resolving real paths). |
| `CURSOR_BRIDGE_MODE` | — | (Deprecated) Execution mode—describe mode in prompt instead |
| `CURSOR_BRIDGE_DEFAULT_MODEL` | `auto` | Default model when request omits one |
| `CURSOR_BRIDGE_STRICT_MODEL` | `true` | Use last requested model when none specified |
| `CURSOR_BRIDGE_FORCE` | `false` | (Deprecated) Force flag—no longer applicable with SDK |
| `CURSOR_BRIDGE_APPROVE_MCPS` | `false` | (Deprecated) MCP approval—handled by SDK automatically |
| `CURSOR_BRIDGE_TIMEOUT_MS` | `300000` | Timeout per completion (ms) |
| `CURSOR_BRIDGE_TLS_CERT` | — | Path to TLS certificate file (e.g. Tailscale cert). Use with `CURSOR_BRIDGE_TLS_KEY` for HTTPS. |
| `CURSOR_BRIDGE_TLS_KEY` | — | Path to TLS private key file. Use with `CURSOR_BRIDGE_TLS_CERT` for HTTPS. |
| `CURSOR_BRIDGE_SESSIONS_LOG` | `~/.cursor-api-proxy/sessions.log` | Path to log file; each request is appended as a line (timestamp, method, path, IP, status). |
| `CURSOR_BRIDGE_CHAT_ONLY_WORKSPACE` | `true` | When `true` (default), the agent runs in an empty temp dir so it **cannot read or write your project**; pure chat only. The proxy also overrides `HOME`, `USERPROFILE`, and `CURSOR_CONFIG_DIR` so the agent cannot load rules from `~/.cursor` or project rules from elsewhere. Set to `false` to pass the real workspace (e.g. for `X-Cursor-Workspace`). |
| `CURSOR_BRIDGE_VERBOSE` | `false` | When `true`, print full request messages and response content to stdout for every completion (both stream and sync). |
| `CURSOR_BRIDGE_MAX_MODE` | `false` | (Deprecated) Max Mode—not supported by SDK |
| `CURSOR_BRIDGE_WIN_CMDLINE_MAX` | `30000` | (Deprecated) No longer needed—SDK handles long prompts on all platforms |
| `CURSOR_CONFIG_DIRS` | — | (Deprecated) No longer used—use separate proxy instances with different API keys |
| `CURSOR_BRIDGE_MULTI_PORT` | `false` | (Deprecated) No longer used—run multiple proxy instances manually |
| `CURSOR_BRIDGE_PROMPT_VIA_STDIN` | `false` | (Deprecated) No longer needed—SDK handles prompt delivery |
| `CURSOR_BRIDGE_USE_ACP` | `false` | (Deprecated) No longer needed—SDK uses native protocols |
| `CURSOR_BRIDGE_ACP_SKIP_AUTHENTICATE` | auto | (Deprecated) No longer applicable |
| `CURSOR_BRIDGE_ACP_RAW_DEBUG` | `false` | (Deprecated) No longer applicable |
| `CURSOR_AGENT_BIN` | `agent` | (Deprecated) No longer needed—SDK handles execution |
| `CURSOR_AGENT_NODE` | — | (Deprecated) No longer needed—SDK handles execution |
| `CURSOR_AGENT_SCRIPT` | — | (Deprecated) No longer needed—SDK handles execution |

### Removed in v2.0

These environment variables are no longer supported:

- `CURSOR_AGENT_BIN`, `CURSOR_CLI_BIN`, `CURSOR_CLI_PATH` — Agent binary path
- `CURSOR_AGENT_NODE`, `CURSOR_AGENT_SCRIPT` — Node.js/script path for Windows
- `CURSOR_BRIDGE_USE_ACP`, `CURSOR_BRIDGE_ACP_SKIP_AUTHENTICATE`, `CURSOR_BRIDGE_ACP_RAW_DEBUG` — ACP protocol settings
- `CURSOR_BRIDGE_PROMPT_VIA_STDIN` — Prompt delivery method
- `CURSOR_BRIDGE_WIN_CMDLINE_MAX` — Windows command line limit
- `CURSOR_BRIDGE_MAX_MODE` — Max Mode
- `CURSOR_BRIDGE_FORCE` — Force flag
- `CURSOR_BRIDGE_APPROVE_MCPS` — MCP approval
- `CURSOR_BRIDGE_MODE` — Execution mode
- `CURSOR_CONFIG_DIRS` — Multi-account config dirs
- `CURSOR_BRIDGE_MULTI_PORT` — Multi-port mode

Notes:

- `--tailscale` changes the default host to `0.0.0.0` only when `CURSOR_BRIDGE_HOST` is not already set.
- Relative paths such as `CURSOR_BRIDGE_WORKSPACE`, `CURSOR_BRIDGE_SESSIONS_LOG`, `CURSOR_BRIDGE_TLS_CERT`, and `CURSOR_BRIDGE_TLS_KEY` are resolved from the current working directory.

### Windows Support

**v2.0+ has native Windows support**—no more command-line limitations or workarounds. The SDK handles all platform differences internally, so long prompts work identically on Windows, macOS, and Linux.

### Multi-Instance Support

If you need to use multiple Cursor accounts, run multiple proxy instances with different `CURSOR_API_KEY` values on different ports:

```bash
# Terminal 1
export CURSOR_API_KEY="key1" && export CURSOR_BRIDGE_PORT=8765 && npm start

# Terminal 2
export CURSOR_API_KEY="key2" && export CURSOR_BRIDGE_PORT=8766 && npm start

# Terminal 3
export CURSOR_API_KEY="key3" && export CURSOR_BRIDGE_PORT=8767 && npm start
```

This provides explicit control over which account each client uses.

## Streaming

The proxy supports `stream: true` on `POST /v1/chat/completions` and `POST /v1/messages`. It returns Server-Sent Events (SSE) in OpenAI's streaming format. The SDK emits incremental deltas; the proxy streams them to clients.

**Test streaming:** from repo root, with the proxy running:

```bash
node examples/test-sdk-integration.mjs
```

See [examples/README.md](examples/README.md) for details.

## License

MIT