import type {
    OcclusionConfig,
    OcclusionData,
    OcclusionElement
} from "../../launchers/showOcclusionEditor";

export type ToolType = "select" | "hand";
export interface OcclusionEditorProps {
    imgURL: string;
    occlusionElements: OcclusionElement[];
    occlusionConfig: OcclusionConfig;
    blockTags: string[];
    resolve: (value: OcclusionData | boolean) => void;
    reject: (reason?: any) => void;
    modalContext?: {modalId: string | null};
}
