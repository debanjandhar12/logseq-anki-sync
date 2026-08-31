---
title: Provider Configurations
---

# Provider Configurations

Open Logseq's plugin settings for Logseq AI Chat and select **Open Provider Configurations**. Provider configurations let you use multiple accounts, endpoints, and provider types in the same model selector.

## Supported Providers

- **OpenAI** uses the pre-populated OpenAI Base URL.
- **Google Gemini** uses the pre-populated Gemini Base URL.
- **OpenAI Compatible** starts with the OpenCode Zen Base URL and accepts any HTTP or HTTPS API Base URL that exposes a `/models` endpoint.
- **Codex** includes experimental ChatGPT OAuth sign-in controls for comparing browser and device authorization libraries.

OpenAI and Gemini Base URL fields are populated automatically and disabled. OpenAI Compatible URLs remain editable, including HTTP endpoints for local providers.

Each configuration needs a unique lowercase ID, an API key, and at least one enabled model. Multiple configurations may use the same provider type and expose the same model ID.

## Managing Models

Select **Fetch Models** to query the configuration's Base URL using its API key. Fetched models are merged into the existing list:

- Existing and manually added models remain in place.
- Existing enabled or disabled states are preserved.
- Newly discovered models are appended and enabled.

Model IDs can also be added, edited, removed, enabled, or disabled manually. Only enabled models appear in chat. The selector groups models by configuration ID, so the same model can be selected through different credentials.

Select **Test** to run a small generation request with the first enabled model. Fetching a model list alone does not prove that a model supports chat requests, so test configurations before saving them.

## Selection And Web Search

The selected model records both the configuration ID and provider model ID. Renaming a selected configuration preserves the selection when that model remains enabled. Deleting or disabling the selected configuration or model falls back to the first enabled model in configuration order.

The global **Model Native** web-search option is applied at request time:

- OpenAI models receive OpenAI native web search.
- Gemini models receive Google Search and URL Context.
- OpenAI Compatible models receive no provider-native search tools.

Jina.ai web tools continue to use the separate global Jina configuration.

## Experimental Codex Sign-In

The Codex provider includes test controls for several OAuth implementations. In Logseq's embedded browser, `@ai-oauth-sdk/browser` is expected to choose OpenAI's device flow. Enable **Device code authorization for Codex** under ChatGPT **Settings > Security** before starting it.

The Browser SDK experiments compare direct `deviceLogin` with flow-aware `autoLogin` and a forced-popup diagnostic. The popup bypasses flow selection and targets OpenAI's fixed `http://localhost:1455/auth/callback`; it is expected to time out unless that callback is being served. Experiments can use session, local, or memory-only storage. Local storage persists bearer credentials across plugin reloads; use **Clear stored credentials** after testing. Notifications show summarized credentials for diagnostics and omit the SDK's duplicate raw token response.

These experimental sessions are not yet connected to the Codex provider used by chat requests. A successful test only verifies authentication and storage behavior.

## Credential Storage

Provider configurations are stored with other Logseq plugin settings as base64-encoded JSON. Base64 is an encoding, not encryption. Anyone with access to the plugin's settings storage can recover the API keys.
