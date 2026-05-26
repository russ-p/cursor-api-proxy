# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-05-25

### Breaking Changes

- **Removed dependency on Cursor CLI (`agent`).** Now uses `@cursor/sdk` directly for all agent execution.
- **`CURSOR_API_KEY` is now required** (was optional when using `agent login`)
- **Removed environment variables:**
  - `CURSOR_AGENT_BIN`, `CURSOR_CLI_BIN`, `CURSOR_CLI_PATH`
  - `CURSOR_AGENT_NODE`, `CURSOR_AGENT_SCRIPT`
  - `CURSOR_BRIDGE_USE_ACP`, `CURSOR_BRIDGE_ACP_SKIP_AUTHENTICATE`, `CURSOR_BRIDGE_ACP_RAW_DEBUG`
  - `CURSOR_BRIDGE_PROMPT_VIA_STDIN`
  - `CURSOR_BRIDGE_WIN_CMDLINE_MAX`
  - `CURSOR_BRIDGE_MAX_MODE`
  - `CURSOR_BRIDGE_FORCE`
  - `CURSOR_BRIDGE_APPROVE_MCPS`
  - `CURSOR_BRIDGE_MODE`
  - `CURSOR_CONFIG_DIRS`, `CURSOR_BRIDGE_MULTI_PORT`
- **Removed CLI subcommands:**
  - `login` - Use `CURSOR_API_KEY` instead
  - Multi-account rotation via `login` - Run multiple proxy instances with different API keys
- **Removed features:**
  - Mode selection (`--mode ask/agent/plan`) - Describe mode in prompt instead
  - Max Mode support
  - Force flag
  - Custom MCP approval settings
  - Windows command-line workarounds (no longer needed)

### Added

- **Native Windows support** — no more cmd.exe limitations or command-line truncation
- **Improved error handling** — typed errors via `CursorAgentError` from SDK
- **Better resource management** — automatic cleanup via `agent[Symbol.asyncDispose]()`
- **Optional cloud runtime support** — set `CURSOR_BRIDGE_USE_CLOUD=true` for cloud execution (under development)
- **SDK-based model listing** — uses `Cursor.models.list()` from SDK
- **Comprehensive integration tests** — `examples/test-sdk-integration.mjs` for end-to-end testing
- **Unit tests for SDK components** — 47 tests for SDK wrapper functions

### Changed

- **Models endpoint** now fetches via SDK instead of `agent --list-models`
- **Chat completions** now use SDK's streaming API
- **Reduced codebase** — removed ~1,377 lines of process spawning and ACP code
- **Removed dependencies:** `chrome-launcher` (no longer needed for login)
- **Error handling** — better HTTP status code mapping via SDK error types
- **Rate limit detection** — more accurate via SDK error patterns
- **Timeout handling** — proper cancellation via SDK's `run.cancel()`

### Fixed

- **Long prompt truncation on Windows** — SDK handles long prompts natively
- **Child process leaks on shutdown** — SDK manages process lifecycle
- **Rate limit detection** — more accurate via SDK error types
- **Timeout handling** — proper cancellation via SDK's `run.cancel()`
- **Cross-platform compatibility** — single code path for all platforms

### Removed

- **Removed files:**
  - `src/lib/agent-cmd-args.ts` — CLI argument building (no longer needed)
  - `src/lib/agent-runner.ts` — Process spawning wrapper (replaced by SDK)
  - `src/lib/process.ts` — Child process utilities (replaced by SDK)
  - `src/lib/acp-client.ts` — ACP protocol client (replaced by SDK)
  - `src/lib/cursor-cli.ts` — CLI wrapper (replaced by SDK)
  - `src/lib/win-cmdline-limit.ts` — Windows workarounds (no longer needed)
  - `src/lib/max-mode-preflight.ts` — Max Mode handling (no longer needed)
  - `src/lib/cli-stream-parser.ts` — Stream parser (replaced by SDK events)
- **Deprecated test files:** Tests for above modules (updated to verify deprecation)

### Migration

- Added comprehensive migration guide in `MIGRATION.md`
- Updated README.md with v2.0 requirements and removed deprecated features
- Added deprecation notices in CLI for removed commands

## [1.0.1] - 2026-02-27

### Fixed
- Fixed ACP authentication issues
- Improved Windows compatibility
- Added multi-account rotation documentation
- Fixed timeout handling in streaming mode

## [1.0.0] - 2026-02-15

### Added
- Initial release with OpenAI-compatible API
- Support for streaming responses
- Multi-account rotation
- Windows support with cmdline workarounds
- ACP (Agent Client Protocol) support
- Anthropic Messages API compatibility
- SDK for OpenAI client integration
- Health check endpoint
- Models listing endpoint
- TLS/HTTPS support
- Tailscale integration

---

[2.0.0]: https://github.com/your-org/cursor-api-proxy/compare/v1.0.1...v2.0.0
[1.0.1]: https://github.com/your-org/cursor-api-proxy/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/your-org/cursor-api-proxy/releases/tag/v1.0.0