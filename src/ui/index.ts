// Base modal component
export { Modal } from "./modals/Modal";

// Hooks
export { useModal } from "./modals/hooks/useModal";
export type { UseModalOptions, UseModalReturn } from "./modals/hooks/useModal";

// Utilities
export { createModalPromise } from "./modals/utils/createModalPromise";
export type { ModalPromiseOptions } from "./modals/utils/createModalPromise";

// Components
export { ModalHeader, SimpleModalHeader } from "./modals/ModalHeader";
export type { ModalHeaderProps } from "./modals/ModalHeader";

export { ModalFooter, DialogModalFooter } from "./modals/ModalFooter";
export type { ModalFooterProps } from "./modals/ModalFooter";

export { showConfirmModal } from "./modals/components/ConfirmModal";
export type { ConfirmModalProps } from "./modals/components/ConfirmModal";

export { showButtonModal } from "./modals/components/ButtonModal";
export type { ButtonModalProps, ButtonModalButton } from "./modals/components/ButtonModal";

export { showSelectionModal } from "./modals/components/SelectionModal";
export type { SelectionModalProps, SelectionModalItem } from "./modals/components/SelectionModal";

// Pages exports
export { showLogseqAnkiFeatureExplorer, ImageOcclusionFeature } from "./pages/LogseqAnkiFeatureExplorer";

export { showOcclusionEditor } from "./pages/OcclusionEditor";
export type { OcclusionElement, OcclusionConfig, OcclusionData } from "./pages/OcclusionEditor";

export { ProgressNotification } from "./pages/ProgressNotification";

export { showSyncResultDialog } from "./pages/SyncResultDialog";

export { showSyncSelectionDialog, AnkiLink, LogseqLink, CreateLineDisplay, UpdateLineDisplay, DeleteLineDisplay } from "./pages/SyncSelectionDialog";
