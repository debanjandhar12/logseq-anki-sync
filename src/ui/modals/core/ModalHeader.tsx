import X_ICON from "@tabler/icons/outline/x.svg?raw";
import type React from "react";
import {useContext} from "react";
import {TablerIcon} from "../../components/TablerIcon";
import {ModalTitleContext} from "./ModalTitleContext";

export interface ModalHeaderProps {
    title: string;
    icon?: string;
    onClose?: () => void;
    showCloseButton?: boolean;
    children?: React.ReactNode;
}

export const ModalHeader: React.FC<ModalHeaderProps> = ({
    title,
    icon,
    onClose,
    showCloseButton = true,
    children
}) => {
    const titleId = useContext(ModalTitleContext);
    return (
        <>
            {showCloseButton && onClose && (
                <div
                    className="absolute top-0 right-0 pt-2 pr-2"
                    style={{display: "flex", alignItems: "center"}}>
                    {children && <>{children}</>}
                    <button
                        aria-label="Close"
                        type="button"
                        className="ui__modal-close opacity-60 hover:opacity-100"
                        onClick={onClose}>
                        <TablerIcon icon={X_ICON} size={24} aria-hidden="true" />
                    </button>
                </div>
            )}
            <header
                style={{
                    borderBottom: "1px solid var(--ls-border-color)",
                    padding: "8px 12px"
                }}>
                <h3
                    id={titleId}
                    className="title inline-flex items-center"
                    style={{marginTop: "2px"}}>
                    {icon && (
                        <i
                            aria-hidden="true"
                            className="px-1"
                            dangerouslySetInnerHTML={{__html: icon}}
                        />
                    )}
                    <strong>{title}</strong>
                </h3>
            </header>
        </>
    );
};

export const SimpleModalHeader: React.FC<{title: string; onClose?: () => void}> = ({title}) => {
    const titleId = useContext(ModalTitleContext);
    return (
        <div className="sm:flex sm:items-start">
            <div className="text-center sm:mt-0 sm:mx-4 sm:text-left w-full">
                <div
                    id={titleId}
                    className="headline mt-4 text-lg leading-6 font-medium"
                    dangerouslySetInnerHTML={{__html: title}}
                />
                <label className="sublabel">
                    <h3 className="subline text-gray-400"></h3>
                </label>
            </div>
        </div>
    );
};
