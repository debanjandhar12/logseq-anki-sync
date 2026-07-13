# Pending Bug Fixes

## Retention of Provider-Executed Tool Parts (AI SDK v6)

### What is currently correct
The guard at:
`src/chat-app/runtime/LocalChatModelAdapter/LocalAISDKChatModelAdapter.ts:85-88` (now at line 90-93) correctly prevents the adapter from executing provider-native tools in the browser.

AI SDK itself only calls local execute for non-provider tools:
`node_modules/ai/src/generate-text/run-tools-transformation.ts:350-387`
Provider results are emitted with `providerExecuted: true` at lines 395-430. Provider-only calls also do not normally cause an AI SDK client-tool continuation:
`node_modules/ai/src/generate-text/stream-text.ts:2157-2213`

Thus provider calls must not produce LocalRuntime `requires-action`.

### What is currently lost
The adapter currently discards:
- Provider tool-call parts.
- Provider tool-result parts.
- Provider tool-error parts.
- Generated file parts.
*(Note: A `source` case was partially added recently, but the rest are still dropped)*

AI SDK’s `fullStream` explicitly includes these:
`node_modules/ai/src/generate-text/stream-text-result.ts:429-465`

**Consequences:**
- Native search can still execute and final text can appear.
- No provider-tool card or result is retained in assistant-ui.
- Persisted history cannot replay the provider-native call/result representation.

### Minimal safe provider support required
1. **Retain Provider Tool Parts**: If provider tool cards are required, retain `tool-call`, `tool-result`, and `tool-error`, but mark them as provider-executed and never set `requires-action` for them. 

2. **Preserve `providerExecuted` Marker**: Preserve that marker through `threadMessageToUIMessage`. AI SDK requires it to place provider results in assistant content rather than a separate tool-role message:
`node_modules/ai/src/ui/convert-to-model-messages.ts:175-233`
`node_modules/ai/src/ui/convert-to-model-messages.ts:256-333`
Do not merely remove the current `providerExecuted` guard and treat provider tools as ordinary frontend tools. That would produce incorrect continuation and model-message protocol.

3. **Extend `ToolCallMessagePart`**: One complication is that assistant-ui’s core `ToolCallMessagePart` has no `providerExecuted` field:
`node_modules/@assistant-ui/core/src/types/message.ts:172-224`
A local intersection/extension, persisted explicitly and recognized by `message-conversion.ts`, is needed for full fidelity.

4. **Align Source and File Shapes**: Ensure `SourceMessagePart` and generated file parts are seamlessly appended. Their shapes generally align between AI SDK and assistant-ui:
AI SDK source:
`node_modules/.pnpm/ai@6.0.224_zod@4.4.3/node_modules/@ai-sdk/provider/src/language-model/v3/language-model-v3-source.ts:6-67`
assistant-ui source:
`node_modules/@assistant-ui/core/src/types/message.ts:26-46`
