import type {
    HighlightMaskConfig,
    HighlightMaskData,
    HighlightMaskElement
} from "../../launchers/showHighlightMaskEditor";

export interface HighlightMaskEditorProps {
    rawText: string;
    highlightElements: HighlightMaskElement[];
    highlightConfig: HighlightMaskConfig;
    blockTags: string[];
    resolve: (value: HighlightMaskData | boolean) => void;
    reject: (reason?: any) => void;
    modalContext?: {modalId: string | null};
}
