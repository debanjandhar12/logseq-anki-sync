import {useCallback, useEffect, useState} from "react";
import type {ModelOption} from "src/chat-app/components/ModelSelector";
import type {ReasoningEffort} from "src/core/ai-sdk/types";
import {createLogger, LoggerCategory} from "src/logger";
import {LogseqSettingAccessor} from "src/logseq/LogseqSettingAccessor";
import type {PluginSettings} from "src/settings";

const DEFAULT_REASONING_EFFORT: ReasoningEffort = "medium";
const logger = createLogger(LoggerCategory.CHAT_UI);
let settingsUpdateQueue = Promise.resolve();

type ModelSelectionSettings = Pick<
    PluginSettings,
    "selectedModelId" | "selectedModelReasoningEffort"
>;

function isReasoningEffort(value: unknown): value is ReasoningEffort {
    return value === "low" || value === "medium" || value === "high";
}

export function usePersistedModelSelection(models: readonly ModelOption[]) {
    const [initialSettings] = useState(() => LogseqSettingAccessor.getPluginSettings());
    const [preferredModelId, setPreferredModelId] = useState(initialSettings.selectedModelId);
    const [reasoningEffort, setReasoningEffortState] = useState<ReasoningEffort>(() =>
        isReasoningEffort(initialSettings.selectedModelReasoningEffort)
            ? initialSettings.selectedModelReasoningEffort
            : DEFAULT_REASONING_EFFORT
    );
    const persistSettings = useCallback((requestedSettings: Partial<ModelSelectionSettings>) => {
        settingsUpdateQueue = settingsUpdateQueue
            .then(async () => {
                const currentSettings = LogseqSettingAccessor.getPluginSettings();
                const changedSettings: Partial<ModelSelectionSettings> = {};

                if (
                    requestedSettings.selectedModelId !== undefined &&
                    requestedSettings.selectedModelId !== currentSettings.selectedModelId
                ) {
                    changedSettings.selectedModelId = requestedSettings.selectedModelId;
                }
                if (
                    requestedSettings.selectedModelReasoningEffort !== undefined &&
                    requestedSettings.selectedModelReasoningEffort !==
                        currentSettings.selectedModelReasoningEffort
                ) {
                    changedSettings.selectedModelReasoningEffort =
                        requestedSettings.selectedModelReasoningEffort;
                }

                if (Object.keys(changedSettings).length > 0) {
                    await LogseqSettingAccessor.updatePluginSettings(changedSettings);
                }
            })
            .catch((error) => {
                logger.error("Failed to persist model selector settings", {
                    requestedSettings,
                    error
                });
            });
    }, []);

    const selectedModelId = models.some((model) => model.id === preferredModelId)
        ? preferredModelId
        : models[0]?.id;

    useEffect(() => {
        if (selectedModelId === undefined || selectedModelId === preferredModelId) return;
        setPreferredModelId(selectedModelId);
        persistSettings({selectedModelId});
    }, [preferredModelId, selectedModelId, persistSettings]);

    useEffect(() => {
        if (isReasoningEffort(initialSettings.selectedModelReasoningEffort)) return;
        persistSettings({selectedModelReasoningEffort: DEFAULT_REASONING_EFFORT});
    }, [initialSettings, persistSettings]);

    const setModelId = useCallback(
        (modelId: string) => {
            if (!models.some((model) => model.id === modelId)) return;
            setPreferredModelId(modelId);
            persistSettings({selectedModelId: modelId});
        },
        [models, persistSettings]
    );

    const setReasoningEffort = useCallback(
        (effort: string) => {
            if (!isReasoningEffort(effort)) return;
            setReasoningEffortState(effort);
            persistSettings({selectedModelReasoningEffort: effort});
        },
        [persistSettings]
    );

    return {
        modelId: selectedModelId,
        reasoningEffort,
        setModelId,
        setReasoningEffort
    };
}
