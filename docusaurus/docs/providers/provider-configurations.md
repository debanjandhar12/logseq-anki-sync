---
title: Provider Configurations
---

# Provider Configurations

Open Logseq's plugin settings for Logseq AI Chat and select **Open Provider Configurations**. Provider configurations let you use multiple accounts, endpoints, and provider types in the same model selector.

## Supported Providers

- **OpenAI** uses the pre-populated OpenAI Base URL.
- **Google Gemini** uses the pre-populated Gemini Base URL.
- **OpenAI Compatible** starts with the OpenCode Zen Base URL and accepts any HTTP or HTTPS API Base URL that exposes a `/models` endpoint.
- **Codex Subscription** signs in to ChatGPT with OpenAI's device-code flow and uses the fixed Codex backend URL. It requires a ChatGPT account with Codex access instead of an API key.

OpenAI, Gemini, and Codex Subscription Base URL fields are populated automatically and disabled. OpenAI Compatible URLs remain editable, including HTTP endpoints for local providers.

Each configuration needs a unique lowercase ID. API-key providers require an API key and at least one enabled model. A signed-out Codex Subscription configuration may be saved without models so you can finish configuring it later.

## Codex Subscription Sign-In

Select **Codex Subscription**, then select the larger **Sign in with Codex Subscription** button. The plugin opens OpenAI's device authorization page, displays a device code, and immediately waits for authorization. Enter the displayed code in the opened page. There is no separate completion button.

After authorization, the provider displays **Signed in to Codex Subscription**. Select **Fetch Models** to load model slugs available to the authenticated account, then use **Test** to run a small generation request.

Sign-in and Logout modify the provider editor draft. Select **Save** to persist either action. Closing the modal without saving discards a new sign-in or Logout. The disabled API key field never displays OAuth credentials.

The plugin automatically refreshes OAuth credentials when required. A refresh performed by an active runtime is persisted immediately so the rotated refresh token is not lost. If authorization is revoked or expires, use Logout, sign in again, and Save.

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
- Codex Subscription models receive OAuth-backed OpenAI native web search.

Jina.ai web tools continue to use the separate global Jina configuration.

## Credential Storage

Provider configurations are stored with other Logseq plugin settings as base64-encoded JSON. Codex access, refresh, and ID tokens are stored as a second versioned base64-encoded payload inside the configuration's API key field. Base64 is an encoding, not encryption. Anyone with access to the plugin's settings storage can recover API keys and reusable Codex credentials.

Codex Subscription uses an unofficial package and private ChatGPT backend endpoints, which can change independently of the public OpenAI API. The current Logseq HTTP proxy also buffers model responses, so Codex output may appear after the upstream response completes instead of token by token, and cancellation may not immediately terminate the network request.
