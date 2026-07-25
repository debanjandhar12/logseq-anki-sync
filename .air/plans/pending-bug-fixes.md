# Pending Bug Fixes

No pending bug fixes are currently documented here.

## Resolved: Retention of Provider-Executed Tool Parts (AI SDK v6)

`LocalAISDKChatModelAdapter` now retains provider-native tool calls, results, and errors while
keeping them out of LocalRuntime's `requires-action` flow. The local tool-call type and
`threadMessageToUIMessage` preserve AI SDK's `providerExecuted` marker, so provider results remain
in assistant content during later model-message conversion and persisted history replay.

The adapter also retains source parts and generated files. Generated files use the same data URL
shape as AI SDK's UI-message stream conversion. Rendering source and file parts is intentionally
left to a separate UI change.

Focused tests cover provider tool success and error results, source and file retention, absence of
`requires-action`, and AI SDK model-message reconversion.
