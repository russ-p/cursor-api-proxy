# Examples

This directory contains example scripts and integration tests for the cursor-api-proxy.

## Files

### test-sdk-integration.mjs
Manual integration test for the SDK migration. Tests all major endpoints and functionality.

**Prerequisites:**
- Set `CURSOR_API_KEY` environment variable with a valid Cursor API key
- Build the project: `npm run build`
- Start the proxy: `npm start` (in another terminal)

**Run the tests:**
```bash
export CURSOR_API_KEY="cursor_..."
npm run build
npm start  # In another terminal
node examples/test-sdk-integration.mjs
```

**Tests included:**
1. Models list endpoint
2. Health check endpoint
3. Chat completion (non-streaming)
4. Chat completion (streaming)
5. Long prompt handling (no Windows limits)
6. Anthropic Messages format
7. Empty prompt handling

### test-sdk.mjs (Deprecated)
Legacy SDK testing script. Use `test-sdk-integration.mjs` instead.

## Adding New Examples

To add a new example:

1. Create the file in this directory (e.g., `my-example.mjs`)
2. Add a brief description to this README
3. Run it with: `node examples/my-example.mjs`

## Notes

- All example scripts require the proxy to be running
- Set `CURSOR_API_KEY` environment variable for API authentication
- See the main README.md for more configuration options