---
title: Provider Configurations
---

# Provider Configurations

Open Logseq's plugin settings for Logseq AI Chat and select **Open Provider Configurations**. Provider configurations let you use multiple accounts, endpoints, and provider types in the same model selector.

## Supported Providers

- **OpenAI** uses the pre-populated OpenAI Base URL.
- **Google Gemini** uses the pre-populated Gemini Base URL.
- **OpenAI Compatible** starts with the OpenCode Zen Base URL and accepts any HTTP or HTTPS API Base URL that exposes a `/models` endpoint.

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

## Credential Storage

Provider configurations are stored with other Logseq plugin settings as base64-encoded JSON. Base64 is an encoding, not encryption. Anyone with access to the plugin's settings storage can recover the API keys.
