# Plan: Model Selector + LLM Model List Refactor

## Overview
Replace the single `llmAPIModel` setting with a model selector UI in the composer. For OpenAI/Google, models come from the `@opencode-ai/models/snapshot` (hardcoded, no HTTP). For OPENAI_COMPATIBLE, models come from splitting the `llmAPIModelList` setting by comma. The selected model flows through assistant-ui's `ModelContext` → `context.config.modelName` into the adapter. Reasoning effort flows via `context.config.reasoningEffort` → AI SDK's native `reasoning` parameter.

---

## Step 1: Install Dependencies

```bash
pnpm add @opencode-ai/models cmdk @base-ui/react
```

Then add shadcn UI components (popover + command):
```bash
pnpm shadcn add popover command --yes
```

This creates `src/shadcn/radix-ui/popover.tsx` and `src/shadcn/radix-ui/command.tsx`.

---

## Step 2: Rename `llmAPIModel` → `llmAPIModelList` in Settings

**File:** `src/settings.ts`

- Rename `llmAPIModel` → `llmAPIModelList` in `PluginSettings` interface (line 14)
- Rename in settings template (line 66-71): key → `llmAPIModelList`, title → "LLM Model List", description → "Comma-separated model identifiers. For example: gpt-4o, gpt-4o-mini, claude-3.5-sonnet"
- In `applySettingsVisibility`: add visibility rule for `llmAPIModelList` — show ONLY when `llmProvider === OPENAI_COMPATIBLE` (same pattern as `llmAPIUrl`). Hide for OpenAI and Google.
- Keep default value `"big-pickle"` (it's the default for OPENAI_COMPATIBLE)

---

## Step 3: Add `PROVIDER_SNAPSHOT_KEY` to types

**File:** `src/core/ai-sdk/types.ts`

Add the mapping from `ProviderEnum` to `@opencode-ai/models` snapshot provider keys:

```ts
export const PROVIDER_SNAPSHOT_KEY: Record<string, string> = {
    [ProviderEnum.OPENAI]: "openai",
    [ProviderEnum.GOOGLE]: "google",
};
```

---

## Step 4: Create `getLLMModelList.ts`

**New file:** `src/core/ai-sdk/getLLMModelList.ts`

```ts
import {providers} from "@opencode-ai/models/snapshot";
import {LogseqSettingAccessor} from "../../logseq/LogseqSettingAccessor";
import {PROVIDER_SNAPSHOT_KEY, ProviderEnum} from "./types";

export interface LLMModelOption {
    id: string;
    name: string;
    description?: string;
    efforts?: boolean; // all models get low/med/high
}

export function getLLMModelList(): LLMModelOption[] {
    const settings = LogseqSettingAccessor.getPluginSettings();
    const provider = settings.llmProvider;

    if (provider === ProviderEnum.OPENAI_COMPATIBLE) {
        const raw = settings.llmAPIModelList ?? "";
        return raw
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
            .map((id) => ({id, name: id, efforts: true}));
    }

    const snapshotKey = provider ? PROVIDER_SNAPSHOT_KEY[provider] : undefined;
    if (!snapshotKey) return [];

    const providerData = providers[snapshotKey];
    if (!providerData) return [];

    return Object.values(providerData.models)
        .filter((m) => m.modalities?.output?.includes("text"))
        .map((m) => ({
            id: m.id,
            name: m.name,
            description: m.description,
            efforts: true,
        }));
}
```

---

## Step 5: Modify `getLLMModel.ts` — Accept Mandatory `modelId`

**File:** `src/core/ai-sdk/getLLMModel.ts`

```ts
export async function getLLMModel(modelId: string) {
    const llmProvider = LogseqSettingAccessor.getPluginSettings().llmProvider;
    const llmAPIUrl = LogseqSettingAccessor.getPluginSettings().llmAPIUrl;
    const llmAPIKey = LogseqSettingAccessor.getPluginSettings().llmAPIKey;

    if (!llmProvider) throw new Error("LLM provider not set");
    if (!llmAPIKey) throw new Error("LLM API Key not set");
    if (!modelId) throw new Error("LLM Model not selected");

    if (llmProvider === ProviderEnum.OPENAI) {
        const openai = createOpenAI({apiKey: llmAPIKey});
        return openai.responses(modelId);
    } else if (llmProvider === ProviderEnum.OPENAI_COMPATIBLE) {
        if (!llmAPIUrl) throw new Error("LLM API URL not set");
        const openaiCompatible = createOpenAICompatible({
            name: "openai-compatible",
            baseURL: llmAPIUrl,
            apiKey: llmAPIKey
        });
        return openaiCompatible.chatModel(modelId);
    } else if (llmProvider === ProviderEnum.GOOGLE) {
        const google = createGoogleGenerativeAI({apiKey: llmAPIKey});
        return google.chat(modelId);
    }

    throw new Error("Unsupported LLM provider");
}
```

---

## Step 6: Copy & Adapt Model Selector Component

**New file:** `src/chat-app/components/ModelSelector.tsx`

Copy the official `model-selector.tsx` from assistant-ui into `src/chat-app/components/ModelSelector.tsx` with these adaptations:

**Changes (documented as comments per project convention):**
- (a) Import paths changed: `@/lib/utils` → `src/shadcn/lib/utils`, `@/components/ui/popover` → `src/shadcn/radix-ui/popover`, `@/components/ui/command` → `src/shadcn/radix-ui/command`
- (b) Removed icon support (`ModelIcon` component and icon prop rendering) to keep it slim
- (c) All models get `efforts: true` (low/med/high) per requirement — no per-model reasoning capability check
- (d) `@base-ui/react/radio-group` and `@base-ui/react/radio` imports kept as-is (installed in Step 1)

---

## Step 7: Create `useModelList` Hook

**New file:** `src/chat-app/hooks/useModelList.ts`

```ts
import {useEffect, useState} from "react";
import {getLLMModelList, type LLMModelOption} from "../../core/ai-sdk/getLLMModelList";
import {LogseqSettingAccessor} from "../../logseq/LogseqSettingAccessor";

export function useModelList(): LLMModelOption[] {
    const [models, setModels] = useState<LLMModelOption[]>(() => getLLMModelList());

    useEffect(() => {
        const update = () => setModels(getLLMModelList());
        update();
        return LogseqSettingAccessor.registerSettingsChangeListener(update);
    }, []);

    return models;
}
```

Note: `registerSettingsChangeListener` currently returns void — it needs a small modification to return an unsubscribe function (see Step 2 of execution).

**Also modify** `LogseqSettingAccessor.registerSettingsChangeListener` to return an `Unsubscribe` function:

**File:** `src/logseq/LogseqSettingAccessor.ts`
```ts
static registerSettingsChangeListener(
    listener: (newSettings: PluginSettings, oldSettings: PluginSettings) => void
): () => void {
    this.registeredSettingsChangeListeners.push(listener);
    return () => {
        const idx = this.registeredSettingsChangeListeners.indexOf(listener);
        if (idx >= 0) this.registeredSettingsChangeListeners.splice(idx, 1);
    };
}
```

---

## Step 8: Add ModelSelector to Composer (inside the shell, above the input)

**File:** `src/chat-app/components/Composer.tsx`

Place the `ModelSelector` inside the composer shell, above the textarea input. Use a compact size:

```tsx
import {ModelSelector} from "src/chat-app/components/ModelSelector";
import {useModelList} from "src/chat-app/hooks/useModelList";

// Inside the composer shell div, before ComposerAttachments or before the input:
<ModelSelectorRow />

// New component at bottom of file:
const ModelSelectorRow: FC = () => {
    const models = useModelList();
    const defaultModelId = models[0]?.id;

    return (
        <div className="flex items-center gap-1 px-1 pb-1">
            <ModelSelector
                models={models}
                defaultValue={defaultModelId}
                defaultEffort="medium"
                size="sm"
                variant="ghost"
                align="start"
            />
        </div>
    );
};
```

**Changes comment update:** `(j) Added ModelSelector component for model and reasoning effort selection inside the composer shell.`

---

## Step 9: Wire Model Selection + Reasoning into the Adapter

**File:** `src/chat-app/runtime/LocalChatModelAdapter/LocalAISDKChatModelAdapter.ts`

```ts
// Before:
const model = await getLLMModel();

// After:
const modelId = context.config?.modelName;
if (!modelId) throw new Error("No model selected");
const model = await getLLMModel(modelId);
```

Add reasoning effort to `streamText` using AI SDK's native `reasoning` parameter (no `providerOptions` needed):

```ts
const reasoningEffort = context.config?.reasoningEffort;

const result = streamText({
    model,
    instructions: context.system,
    messages: modelMessages,
    tools,
    abortSignal,
    ...context.callSettings,
    ...(reasoningEffort ? {reasoning: reasoningEffort as "low" | "medium" | "high"} : {}),
    onError: ({error}) => { streamError = error; }
});
```

The AI SDK v4 `streamText` accepts `reasoning?: 'provider-default' | 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh'` directly — no provider-specific options needed.

---

## Step 10: Update All `llmAPIModel` References

Search and update any remaining references to `llmAPIModel`:
- `src/core/ai-sdk/getLLMModel.ts` — now takes `modelId` param, not settings
- `src/settings.ts` — renamed to `llmAPIModelList`
- `src/core/ai-sdk/getLLMProviderTools.ts` — no model reference (only API key)
- Any tests that reference `llmAPIModel`

---

## Files Modified/Created Summary

| Action | File |
|--------|------|
| Modify | `package.json` (new deps) |
| Modify | `src/settings.ts` (rename setting, visibility) |
| Modify | `src/core/ai-sdk/types.ts` (add `PROVIDER_SNAPSHOT_KEY`) |
| Create | `src/core/ai-sdk/getLLMModelList.ts` |
| Modify | `src/core/ai-sdk/getLLMModel.ts` (mandatory `modelId` param) |
| Modify | `src/logseq/LogseqSettingAccessor.ts` (return unsubscribe) |
| Create | `src/chat-app/components/ModelSelector.tsx` |
| Create | `src/chat-app/hooks/useModelList.ts` |
| Modify | `src/chat-app/components/Composer.tsx` (add ModelSelector) |
| Modify | `src/chat-app/runtime/LocalChatModelAdapter/LocalAISDKChatModelAdapter.ts` (use `modelId` + `reasoning`) |
| Create | `src/shadcn/radix-ui/popover.tsx` (via shadcn add) |
| Create | `src/shadcn/radix-ui/command.tsx` (via shadcn add) |

---

## Verification

1. **Type check:** `npx tsc --noEmit`
2. **Lint:** `pnpm run check:fix src/settings.ts src/core/ai-sdk/types.ts src/core/ai-sdk/getLLMModelList.ts src/core/ai-sdk/getLLMModel.ts src/logseq/LogseqSettingAccessor.ts src/chat-app/components/ModelSelector.tsx src/chat-app/hooks/useModelList.ts src/chat-app/components/Composer.tsx src/chat-app/runtime/LocalChatModelAdapter/LocalAISDKChatModelAdapter.ts --reporter=summary`
3. **Build:** `pnpm build`
4. **Manual test:** Open chat → verify model selector appears inside the composer above the input. With OpenAI provider selected, verify models from snapshot appear. Switch to Google → verify model list updates reactively. Switch to OPENAI_COMPATIBLE → verify comma-split models from `llmAPIModelList` setting work. Select a model + reasoning effort (low/med/high), send a message and verify the correct model + reasoning is used.
