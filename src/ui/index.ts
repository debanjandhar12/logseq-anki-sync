// Base modal component
export { Modal } from "./modals/core/Modal";

// Hooks
export { useModal } from "./modals/hooks/useModal";
export type { UseModalOptions, UseModalReturn } from "./modals/hooks/useModal";

// Utilities
export { createModalPromise } from "./modals/utils/createModalPromise";
export type { ModalPromiseOptions } from "./modals/utils/createModalPromise";

// Components
export { ModalHeader, SimpleModalHeader } from "./modals/core/ModalHeader";
export type { ModalHeaderProps } from "./modals/core/ModalHeader";

export { ModalFooter, DialogModalFooter } from "./modals/core/ModalFooter";
export type { ModalFooterProps } from "./modals/core/ModalFooter";

export { showConfirmModal } from "./modals/ConfirmModal";
export type { ConfirmModalProps } from "./modals/ConfirmModal";

export { showButtonModal } from "./modals/ButtonModal";
export type { ButtonModalProps, ButtonModalButton } from "./modals/ButtonModal";

export { showSelectionModal } from "./modals/SelectionModal";
export type { SelectionModalProps, SelectionModalItem } from "./modals/SelectionModal";

export { showInputModal } from "./modals/InputModal";
export type { InputModalProps } from "./modals/InputModal";

// Pages exports
export { showLogseqAnkiFeatureExplorer } from "./pages/LogseqAnkiFeatureExplorer";

export { showOcclusionEditor } from "./pages/OcclusionEditor";
export type { OcclusionElement, OcclusionConfig, OcclusionData } from "./pages/OcclusionEditor";

export { ProgressNotification } from "./notifications/ProgressNotification";
export { ActionNotification } from "./notifications/ActionNotification";

export { showSyncResultDialog } from "./pages/SyncResultDialog";

export { showSyncSelectionDialog, AnkiLink, LogseqLink, CreateLineDisplay, UpdateLineDisplay, DeleteLineDisplay } from "./pages/SyncSelectionDialog";
