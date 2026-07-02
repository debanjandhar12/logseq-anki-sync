# Logseq Plugin CORS & Streaming Issue

## The Core Problem

As of the latest Logseq Electron updates, Logseq plugins run within a highly restricted iframe under the `lsp://logseq.com` origin. This introduces a fatal conflict when attempting to make streaming / non-streaming HTTP requests to external APIs (such as OpenAI, Anthropic, Ollama, or opencode.ai).

1. **Strict Origin Preflight:** The Chromium network stack in Electron strictly enforces CORS. Because `lsp://` is a custom protocol, external APIs and Electron's own security layers frequently reject the `OPTIONS` preflight request.
2. **Streaming Requirement:** AI features (like `ai-sdk`) absolutely require HTTP streaming (`ReadableStream`). 

## What Has Been Attempted

We have exhausted all vectors to bypass CORS while retaining stream capabilities. Here is the chronological history of attempted workarounds:

### 1. Node.js `require` (Native HTTP Stream)
- **Approach:** Use `window.parent.require("https")` to bypass browser `fetch` entirely and utilize Node.js's native `http`/`https` modules, which are not subject to CORS and support true streaming via `ReadableStream`.
- **Result:** **FAILED.** The latest Logseq updates enforce strict context isolation (`contextIsolation: true` or `nodeIntegration: false`), completely removing access to `require` from `window.top` or `window.parent`.

### 2. Use window.top.fetch
- **Approach:** Use `window.top.fetch` to bypass CORS.
- **Result:** **FAILED.** The parent window's fetch also faces CORS.

### 3. Logseq's Internal Proxy (`exper_request`)
- **Approach:** Use `@benjypng/logseq-request`, which hooks into Logseq's `exper_request` (via `_execCallableAPIAsync`). This routes the network request through Logseq's main Electron process, successfully bypassing CORS.
- **Result:** **FAILED.** `exper_request` strictly buffers the entire HTTP response into memory before resolving the IPC promise. It fundamentally lacks streaming capabilities. The `ai-sdk` waits silently until the generation completes and receives the entire block of text at once.

### 4. The `effect: true` Manifest Flag
- **Approach:** Added `"effect": true` to the `package.json` logseq configuration block. In older versions of Logseq, this modified the iframe sandbox permissions or origin handling to allow cross-origin requests.
- **Result:** **FAILED.** The latest Electron update still strictly blocks `lsp://logseq.com` at the preflight stage, regardless of this flag.

### 5. The "Opaque Origin" Iframe Bypass
- **Approach:** Injected a hidden `<iframe>` via a `data:` URI with `sandbox="allow-scripts"` (intentionally omitting `allow-same-origin`). This forces the browser to execute the fetch from a `null` origin, which bypasses the `lsp://` custom protocol restrictions. We then bridged the `ReadableStream` chunks back to the plugin via `postMessage`.
- **Result:** **FAILED.** Still faces CORS from electron.