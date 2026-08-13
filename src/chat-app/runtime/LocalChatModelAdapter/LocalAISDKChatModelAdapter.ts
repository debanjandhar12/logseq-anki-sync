import type {ChatModelAdapter} from "@assistant-ui/react";
import {runLocalAISDKChatModel} from "./runLocalAISDKChatModel";

/**
 * Bridges assistant-ui's branch-aware LocalRuntime to the AI SDK.
 *
 * LocalRuntime excludes the in-progress assistant child from roundtrip context, so the runner uses
 * unstable_getMessage() for prior tool results and yields only current-step content to avoid
 * duplication. Project frontend tools execute strictly in emitted order. They stay running during
 * execution, then the final requires-action/tool-calls status drives LocalRuntime continuation.
 */
export const LocalAISDKChatModelAdapter: ChatModelAdapter = {
    run: runLocalAISDKChatModel
};
