// Base modal component
export {Modal} from "./modals/core/Modal";

// Hooks
export {useModal} from "./modals/hooks/useModal";
export type {UseModalOptions, UseModalReturn} from "./modals/hooks/useModal";

// Utilities
export {createModalPromise} from "./modals/utils/createModalPromise";
export type {ModalPromiseOptions} from "./modals/utils/createModalPromise";

// Components
export {ModalHeader, SimpleModalHeader} from "./modals/core/ModalHeader";
export type {ModalHeaderProps} from "./modals/core/ModalHeader";

export {ModalFooter, DialogModalFooter} from "./modals/core/ModalFooter";
export type {ModalFooterProps} from "./modals/core/ModalFooter";

// Modal launchers
export {showConfirmModal} from "./launchers/showConfirmModal";
export {showButtonModal} from "./launchers/showButtonModal";
export type {ButtonModalButton} from "./launchers/showButtonModal";
export {showSelectionModal} from "./launchers/showSelectionModal";
export type {SelectionModalItem} from "./launchers/showSelectionModal";
export {showInputModal} from "./launchers/showInputModal";

// Modal components (for launcher use)
export {ConfirmModalComponent} from "./modals/ConfirmModal";
export type {ConfirmModalProps} from "./modals/ConfirmModal";
export {ButtonModalComponent} from "./modals/ButtonModal";
export type {ButtonModalProps} from "./modals/ButtonModal";
export {SelectionModalComponent} from "./modals/SelectionModal";
export type {SelectionModalProps} from "./modals/SelectionModal";
export {InputModalComponent} from "./modals/InputModal";
export type {InputModalProps} from "./modals/InputModal";

// Page launchers
export {showLogseqAnkiFeatureExplorer} from "./launchers/showLogseqAnkiFeatureExplorer";

export {showOcclusionEditor} from "./launchers/showOcclusionEditor";
export type {OcclusionElement, OcclusionConfig, OcclusionData} from "./launchers/showOcclusionEditor";

export {showHighlightMaskEditor} from "./launchers/showHighlightMaskEditor";
export type {
    HighlightMaskElement,
    HighlightMaskConfig,
    HighlightMaskData,
} from "./launchers/showHighlightMaskEditor";

export {showSyncResultDialog} from "./launchers/showSyncResultDialog";

export {showSyncSelectionDialog} from "./launchers/showSyncSelectionDialog";

// Page components (for launcher use)
export {LogseqAnkiFeatureExplorerComponent} from "./pages/LogseqAnkiFeatureExplorer";
export {OcclusionEditorComponent} from "./pages/OcclusionEditor";
export {HighlightMaskEditorComponent} from "./pages/HighlightMaskEditor";
export {SyncResultDialogComponent} from "./pages/SyncResultDialog";
export {SyncSelectionDialogComponent} from "./pages/SyncSelectionDialog";

// Helper components from SyncSelectionDialog
export {
    AnkiLink,
    LogseqLink,
    CreateLineDisplay,
    UpdateLineDisplay,
    DeleteLineDisplay,
} from "./pages/SyncSelectionDialog";

// Notifications
export {ProgressNotification} from "./notifications/ProgressNotification";
export {ActionNotification} from "./notifications/ActionNotification";
