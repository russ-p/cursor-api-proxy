/**
 * Manual Integration Test for SDK Migration
 *
 * This file contains manual integration tests that should be run with:
 *
 * ```bash
 * export CURSOR_API_KEY="cursor_..."
 * npm run build
 * node examples/test-sdk-integration.mjs
 * ```
 *
 * Prerequisites:
 * - CURSOR_API_KEY must be set with a valid Cursor API key
 * - The proxy must be built (npm run build)
 * - The proxy must be running (npm start)
 */

import http from "node:http";

const TEST_CONFIG = {
  host: "127.0.0.1",
  port: 8765,
  apiKey: process.env.CURSOR_API_KEY,
};

/**
 * Helper function to make HTTP requests
 */
function makeRequest(
  path: string,
  method: string = "GET",
  body?: string,
  headers: Record<string, string> = {},
): Promise<{ statusCode: number; headers: http.IncomingHttpHeaders; data: string }> {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: TEST_CONFIG.host,
      port: TEST_CONFIG.port,
      path,
      method,
      headers: {
        ...headers,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
    };

    const req = http.request(options, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        resolve({
          statusCode: res.statusCode!,
          headers: res.headers,
          data,
        });
      });
    });

    req.on("error", reject);

    if (body) {
      req.write(body);
    }

    req.end();
  });
}

/**
 * Test 1: Models List Endpoint
 */
async function testModelsEndpoint() {
  console.log("\n📋 Test 1: Models List Endpoint");

  try {
    const response = await makeRequest("/v1/models");
    const result = JSON.parse(response.data);

    console.log(`Status: ${response.statusCode}`);
    console.log(`Models count: ${result.data.length}`);

    if (response.statusCode === 200 && Array.isArray(result.data)) {
      console.log("✓ Models endpoint working");
      console.log(`  Sample models: ${result.data.slice(0, 3).map((m: any) => m.id).join(", ")}`);
      return true;
    } else {
      console.log("✗ Models endpoint failed");
      console.log(`  Response: ${response.data}`);
      return false;
    }
  } catch (error) {
    console.log("✗ Models endpoint error:", error);
    return false;
  }
}

/**
 * Test 2: Health Check Endpoint
 */
async function testHealthEndpoint() {
  console.log("\n🏥 Test 2: Health Check Endpoint");

  try {
    const response = await makeRequest("/health");
    const result = JSON.parse(response.data);

    console.log(`Status: ${response.statusCode}`);
    console.log(`Server info:`, {
      ok: result.ok,
      version: result.version,
      useCloudRuntime: result.useCloudRuntime,
    });

    if (response.statusCode === 200 && result.ok === true) {
      console.log("✓ Health endpoint working");
      return true;
    } else {
      console.log("✗ Health endpoint failed");
      return false;
    }
  } catch (error) {
    console.log("✗ Health endpoint error:", error);
    return false;
  }
}

/**
 * Test 3: Chat Completion (Simple)
 */
async function testChatCompletionSimple() {
  console.log("\n💬 Test 3: Chat Completion (Simple, Non-Streaming)");

  try {
    const body = JSON.stringify({
      model: "auto",
      messages: [{ role: "user", content: "Say 'Hello SDK' in one sentence." }],
    });

    const response = await makeRequest("/v1/chat/completions", "POST", body);
    const result = JSON.parse(response.data);

    console.log(`Status: ${response.statusCode}`);
    console.log(`Model: ${result.model}`);
    console.log(`Response: ${result.choices[0].message.content?.substring(0, 100)}...`);

    if (response.statusCode === 200 && result.choices[0].message.content) {
      console.log("✓ Chat completion working");
      console.log(`  Usage:`, result.usage);
      return true;
    } else if (response.error) {
      console.log("✗ Chat completion error:", response.error.message);
      return false;
    } else {
      console.log("✗ Chat completion failed");
      console.log(`  Response: ${response.data}`);
      return false;
    }
  } catch (error) {
    console.log("✗ Chat completion error:", error);
    return false;
  }
}

/**
 * Test 4: Chat Completion (Streaming)
 */
async function testChatCompletionStreaming() {
  console.log("\n💬 Test 4: Chat Completion (Streaming)");

  return new Promise((resolve) => {
    try {
      const body = JSON.stringify({
        model: "auto",
        messages: [{ role: "user", content: "Count from 1 to 3, one number per line." }],
        stream: true,
      });

      const options = {
        hostname: TEST_CONFIG.host,
        port: TEST_CONFIG.port,
        path: "/v1/chat/completions",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      };

      let chunkCount = 0;
      let fullResponse = "";

      const req = http.request(options, (res) => {
        console.log(`Status: ${res.statusCode}`);

        if (res.statusCode !== 200) {
          console.log("✗ Streaming failed with non-200 status");
          resolve(false);
          return;
        }

        res.on("data", (chunk) => {
          const lines = chunk.toString().split("\n");
          for (const line of lines) {
            if (line.startsWith("data: ") && line !== "data: [DONE]") {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.choices?.[0]?.delta?.content) {
                  fullResponse += data.choices[0].delta.content;
                  chunkCount++;
                  process.stdout.write(data.choices[0].delta.content);
                }
              } catch {
                // Ignore parse errors for incomplete chunks
              }
            }
          }
        });

        res.on("end", () => {
          console.log("\n");
          if (chunkCount > 0 && fullResponse) {
            console.log(`✓ Streaming working (${chunkCount} chunks)`);
            resolve(true);
          } else {
            console.log("✗ Streaming failed (no chunks received)");
            resolve(false);
          }
        });
      });

      req.on("error", (error) => {
        console.log("✗ Streaming error:", error);
        resolve(false);
      });

      req.write(body);
      req.end();
    } catch (error) {
      console.log("✗ Streaming error:", error);
      resolve(false);
    }
  });
}

/**
 * Test 5: Long Prompt (No Windows Limit)
 */
async function testLongPrompt() {
  console.log("\n📝 Test 5: Long Prompt (No Windows Limit)");

  try {
    // Create a very long prompt (~10KB)
    const longText = "This is a test sentence. ".repeat(200);
    const body = JSON.stringify({
      model: "auto",
      messages: [
        {
          role: "user",
          content: `Summarize this text in one word: ${longText}`,
        },
      ],
    });

    const response = await makeRequest("/v1/chat/completions", "POST", body);
    const result = JSON.parse(response.data);

    console.log(`Prompt length: ${longText.length} chars`);

    if (response.statusCode === 200 && result.choices[0].message.content) {
      console.log("✓ Long prompt working");
      console.log(`  Response: ${result.choices[0].message.content.substring(0, 100)}...`);
      return true;
    } else if (response.error) {
      console.log("✗ Long prompt error:", response.error.message);
      return false;
    } else {
      console.log("✗ Long prompt failed");
      return false;
    }
  } catch (error) {
    console.log("✗ Long prompt error:", error);
    return false;
  }
}

/**
 * Test 6: Anthropic Messages Format
 */
async function testAnthropicMessagesFormat() {
  console.log("\n🤖 Test 6: Anthropic Messages Format");

  try {
    const body = JSON.stringify({
      model: "auto",
      max_tokens: 100,
      messages: [{ role: "user", content: "Say 'Anthropic format works' in one sentence." }],
    });

    const response = await makeRequest("/v1/messages", "POST", body);
    const result = JSON.parse(response.data);

    console.log(`Status: ${response.statusCode}`);
    console.log(`Response: ${result.content?.[0]?.text?.substring(0, 100)}...`);

    if (response.statusCode === 200 && result.content?.[0]?.text) {
      console.log("✓ Anthropic format working");
      console.log(`  Usage:`, result.usage);
      return true;
    } else if (response.error) {
      console.log("✗ Anthropic format error:", response.error.message);
      return false;
    } else {
      console.log("✗ Anthropic format failed");
      return false;
    }
  } catch (error) {
    console.log("✗ Anthropic format error:", error);
    return false;
  }
}

/**
 * Test 7: Empty Prompt Handling
 */
async function testEmptyPrompt() {
  console.log("\n⚠️  Test 7: Empty Prompt Handling");

  try {
    const body = JSON.stringify({
      model: "auto",
      messages: [{ role: "user", content: "" }],
    });

    const response = await makeRequest("/v1/chat/completions", "POST", body);
    const result = JSON.parse(response.data);

    console.log(`Status: ${response.statusCode}`);

    // Should handle gracefully (either 200 or proper error)
    if (response.statusCode === 200 || response.statusCode === 400) {
      console.log("✓ Empty prompt handled gracefully");
      return true;
    } else {
      console.log("✗ Empty prompt not handled properly");
      return false;
    }
  } catch (error) {
    console.log("✗ Empty prompt error:", error);
    return false;
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║  SDK Integration Tests                                    ║");
  console.log("╚════════════════════════════════════════════════════════════╝");

  if (!TEST_CONFIG.apiKey) {
    console.log("\n❌ CURSOR_API_KEY not set!");
    console.log("   Set it with: export CURSOR_API_KEY='cursor_...'\n");
    process.exit(1);
  }

  const results = {
    models: await testModelsEndpoint(),
    health: await testHealthEndpoint(),
    chatSimple: await testChatCompletionSimple(),
    chatStreaming: await testChatCompletionStreaming(),
    longPrompt: await testLongPrompt(),
    anthropicFormat: await testAnthropicMessagesFormat(),
    emptyPrompt: await testEmptyPrompt(),
  };

  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║  Test Results                                            ║");
  console.log("╚════════════════════════════════════════════════════════════╝");

  const summary = Object.entries(results).map(([name, passed]) => ({
    name,
    status: passed ? "✓ PASS" : "✗ FAIL",
  }));

  summary.forEach(({ name, status }) => {
    console.log(`${status.padEnd(10)} ${name}`);
  });

  const passedCount = Object.values(results).filter(Boolean).length;
  const totalCount = Object.keys(results).length;

  console.log("\n" + "=".repeat(60));
  console.log(`Summary: ${passedCount}/${totalCount} tests passed`);

  if (passedCount === totalCount) {
    console.log("✅ All integration tests passed!");
    process.exit(0);
  } else {
    console.log("❌ Some tests failed. Please check the output above.");
    process.exit(1);
  }
}

runAllTests().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});