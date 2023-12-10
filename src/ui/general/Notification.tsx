import React, {PropsWithChildren} from "react";
import ReactDOM from "react-dom";

export function Notification({
    open,
    setOpen,
    onClose,
    hasCloseBtn,
    icon,
    children,
}: PropsWithChildren<{}>) {
    React.useEffect(() => {
        if (!open && onClose) {
            onClose();
        }
    }, [open]);

    if (!open) return null;

    return (
        <div className="max-w-sm w-full shadow-lg rounded-lg pointer-events-auto notification-area transition ease-out duration-300 transform translate-y-0 opacity-100 sm:translate-x-0">
            <div
                className="rounded-lg shadow-xs"
                style={{maxHeight: "calc(100vh - 200px)", overflow: "hidden auto"}}>
                <div className="p-4">
                    <div className="flex items-start">
                        <div
                            className="flex-shrink-0"
                            dangerouslySetInnerHTML={{__html: icon}}></div>
                        <div className="ml-3 w-0 flex-1">
                            <div
                                className="text-sm leading-5 font-medium whitespace-pre-line"
                                style={{margin: "0px"}}>
                                {children}
                            </div>
                        </div>
                        <div className="ml-4 flex-shrink-0 flex">
                            {hasCloseBtn && (
                                <button
                                    aria-label="Close"
                                    className="inline-flex text-gray-400 focus:outline-none focus:text-gray-500 transition ease-in-out duration-150 notification-close-button"
                                    onClick={() => setOpen(false)}>
                                    <span className="ui__icon ti ls-icon-x ">
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            className="icon icon-tabler icon-tabler-x"
                                            width="18"
                                            height="18"
                                            viewBox="0 0 24 24"
                                            strokeWidth="2"
                                            stroke="currentColor"
                                            fill="currentColor"
                                            strokeLinecap="round"
                                            strokeLinejoin="round">
                                            <path
                                                stroke="none"
                                                d="M0 0h24v24H0z"
                                                fill="none"></path>
                                            <line x1="18" y1="6" x2="6" y2="18"></line>
                                            <line x1="6" y1="6" x2="18" y2="18"></line>
                                        </svg>
                                    </span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
