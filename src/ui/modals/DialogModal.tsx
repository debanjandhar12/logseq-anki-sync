// import React from "../../React";
// import { Modal } from "../Modal";
// import { useModal } from "../hooks/useModal";
// import { ModalHeader } from "../ModalHeader";
// import { DialogModalFooter } from "../ModalFooter";
// import { createModalPromise } from "../utils/createModalPromise";
//
// export interface DialogModalProps<T = any> {
//     title: string;
//     icon?: string;
//     children: React.ReactNode;
//     onConfirm?: () => T | void;
//     onCancel?: () => void;
//     confirmText?: string;
//     cancelText?: string;
//     showConfirm?: boolean;
//     showCancel?: boolean;
//     enableEscapeKey?: boolean;
//     enableEnterKey?: boolean;
//     footerContent?: React.ReactNode;
//     headerContent?: React.ReactNode;
//     resolve: (value: T | null) => void;
//     reject: (error: any) => void;
//     onClose: () => void;
// }
//
// const DialogModalComponent = <T,>({
//     title,
//     icon,
//     children,
//     onConfirm,
//     onCancel,
//     confirmText = "Confirm",
//     cancelText = "Cancel",
//     showConfirm = true,
//     showCancel = true,
//     enableEscapeKey = true,
//     enableEnterKey = false,
//     footerContent,
//     headerContent,
//     resolve,
//     reject,
//     onClose,
// }: DialogModalProps<T>) => {
//     const { open, setOpen, handleConfirm, handleCancel } = useModal<T | null>(resolve, {
//         onClose,
//         enableEscapeKey,
//         enableEnterKey,
//         onConfirm: onConfirm ? () => onConfirm() : undefined,
//         onCancel,
//     });
//
//     const handleConfirmClick = () => {
//         if (onConfirm) {
//             const result = onConfirm();
//             handleConfirm(result);
//         } else {
//             handleConfirm();
//         }
//     };
//
//     return (
//         <Modal open={open} setOpen={setOpen} onClose={onClose} hasCloseButton={false}>
//             <div className="of-plugins pb-2" style={{ margin: '-2rem' }}>
//                 <ModalHeader
//                     title={title}
//                     icon={icon}
//                     onClose={() => setOpen(false)}
//                     showCloseButton={true}
//                 >
//                     {headerContent}
//                 </ModalHeader>
//                 <div
//                     className="sm:flex sm:items-start"
//                     style={{ maxHeight: "70vh", overflowY: "auto", overflowX: "hidden" }}
//                 >
//                     <div
//                         className="mt-3 sm:mt-0 ml-4 mr-4 flex"
//                         style={{ width: "100%", flexDirection: "column" }}
//                     >
//                         {children}
//                     </div>
//                 </div>
//                 {(showConfirm || showCancel || footerContent) && (
//                     <DialogModalFooter
//                         onConfirm={showConfirm ? handleConfirmClick : undefined}
//                         onCancel={showCancel ? handleCancel : undefined}
//                         confirmText={confirmText}
//                         cancelText={cancelText}
//                     >
//                         {footerContent}
//                     </DialogModalFooter>
//                 )}
//             </div>
//         </Modal>
//     );
// };
//
// /**
//  * Dialog modal for complex interactions
//  */
// export async function showDialogModal<T = any>(
//     config: {
//         title: string;
//         icon?: string;
//         children: React.ReactNode;
//         onConfirm?: () => T | void;
//         onCancel?: () => void;
//         confirmText?: string;
//         cancelText?: string;
//         showConfirm?: boolean;
//         showCancel?: boolean;
//         enableEscapeKey?: boolean;
//         enableEnterKey?: boolean;
//         footerContent?: React.ReactNode;
//         headerContent?: React.ReactNode;
//     }
// ): Promise<T | null> {
//     return createModalPromise<T | null>(
//         (props) => (
//             <DialogModalComponent
//                 {...config}
//                 {...props}
//             />
//         ),
//         {},
//         { errorMessage: "Failed to open dialog modal" }
//     );
// }
