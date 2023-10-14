import React, {FC} from "react";

type LogseqButtonProps = {
    children: React.ReactNode,
    onClick?: () => void,
    icon?: string,
    isFullWidth?: boolean,
    disabled?: boolean,
    color?: 'primary' | 'default' | 'success' | 'faded-default',
};

export const LogseqButton: FC<LogseqButtonProps> = ({children, onClick, icon, isFullWidth, color, disabled, isCentered}) => {
    let classNameString = 'inline-flex justify-center rounded-md reduce-opacity-when-disabled not-allowed-cursor-when-disabled';
    if (color === 'primary') {
        classNameString += ' border border-transparent px-4 py-2 bg-indigo-600 text-base leading-6 font-medium text-white shadow-sm hover:bg-indigo-500 focus:outline-none focus:border-indigo-700 focus:shadow-outline-indigo ui__modal-enter';
    }
    else { // default or faded-default
        classNameString += ' border border-gray-300 px-4 py-2 bg-white text-base leading-6 font-medium text-gray-700 shadow-sm hover:text-gray-500 focus:outline-none focus:border-blue-300 focus:shadow-outline-blue';
    }

    if (color.includes('faded')) {
        classNameString += ' opacity-50';
    }

    if (isFullWidth) {
        classNameString += ' w-full';
    }

    if (isCentered){
        classNameString += ' justify-center';
    }

    return (
        <button
            disabled={disabled}
            className={classNameString}
            style={{margin: '0.125rem 0.25rem 0.125rem 0', padding: '0.35rem'}}
            onClick={onClick}>
            {icon && <span className="icon" dangerouslySetInnerHTML={{__html: icon}}/>}
            {children}
        </button>
    );
};
