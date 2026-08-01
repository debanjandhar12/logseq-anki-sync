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
