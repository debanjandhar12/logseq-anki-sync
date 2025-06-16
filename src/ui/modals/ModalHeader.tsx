import React from "../React";

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
    children,
}) => {
    return (
        <>
            {showCloseButton && onClose && (
                <div className="absolute top-0 right-0 pt-2 pr-2" style={{ display: "flex", alignItems: "center" }}>
                    {children && (
                        <>
                            {children}
                        </>
                    )}
                    <button
                        aria-label="Close"
                        type="button"
                        className="ui__modal-close opacity-60 hover:opacity-100"
                        onClick={onClose}
                    >
                        <svg
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            fill="none"
                            className="h-6 w-6"
                        >
                            <path
                                d="M6 18L18 6M6 6l12 12"
                                strokeWidth="2"
                                strokeLinejoin="round"
                                strokeLinecap="round"
                            />
                        </svg>
                    </button>
                </div>
            )}
            <header
                style={{
                    borderBottom: "1px solid var(--ls-border-color)",
                    padding: "8px 12px",
                }}
            >
                <h3 className="title inline-flex items-center" style={{ marginTop: "2px" }}>
                    {icon && (
                        <i className="px-1" dangerouslySetInnerHTML={{ __html: icon }} />
                    )}
                    <strong>{title}</strong>
                </h3>
            </header>
        </>
    );
};

export const SimpleModalHeader: React.FC<{ title: string; onClose?: () => void }> = ({
    title,
    onClose,
}) => {
    return (
        <div className="sm:flex sm:items-start">
            <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                <h2 className="headline text-lg leading-6 font-medium">
                    {title}
                </h2>
                <label className="sublabel">
                    <h3 className="subline text-gray-400"></h3>
                </label>
            </div>
        </div>
    );
};
