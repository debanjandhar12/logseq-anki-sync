// Base modal component
export { Modal } from "./Modal";

// Hooks
export { useModal } from "./hooks/useModal";
export type { UseModalOptions, UseModalReturn } from "./hooks/useModal";

// Utilities
export { createModalPromise } from "./utils/createModalPromise";
export type { ModalPromiseOptions } from "./utils/createModalPromise";

// Components
export { ModalHeader, SimpleModalHeader } from "./ModalHeader";
export type { ModalHeaderProps } from "./ModalHeader";

export { ModalFooter, DialogModalFooter } from "./ModalFooter";
export type { ModalFooterProps } from "./ModalFooter";

export { showConfirmModal } from "./components/ConfirmModal";
export type { ConfirmModalProps } from "./components/ConfirmModal";

export { showButtonModal } from "./components/ButtonModal";
export type { ButtonModalProps, ButtonModalButton } from "./components/ButtonModal";

export { showSelectionModal } from "./components/SelectionModal";
export type { SelectionModalProps, SelectionModalItem } from "./components/SelectionModal";
