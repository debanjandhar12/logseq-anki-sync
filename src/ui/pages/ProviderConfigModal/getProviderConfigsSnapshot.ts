import type {EditableProviderConfig} from "./types";

export function getProviderConfigsSnapshot(configs: EditableProviderConfig[]): string {
    return JSON.stringify(configs.map(({editorKey: _editorKey, ...config}) => config));
}
