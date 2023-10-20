import React, {FC} from "react";
type LogseqButtonProps = {
    children: React.ReactNode,
    onClick?: () => void,
    icon?: string,
    isFullWidth?: boolean,
    disabled?: boolean,
    color?: 'primary' | 'default' | 'success' | 'faded-default',
    size?: 'sm' | 'md' | 'lg'
};
export const LogseqButton: FC<LogseqButtonProps> = ({children, onClick, icon, isFullWidth, color, disabled, size="md"}) => {
    let classNameString = 'inline-flex justify-center rounded-md reduce-opacity-when-disabled not-allowed-cursor-when-disabled';

    switch (size) {
        case 'sm':
            classNameString += ' px-0 py-0';
            classNameString += ' text-sm';
            break;
        case 'lg':
            classNameString += ' px-4 py-2';
            classNameString +=' text-lg';
            break;
        default: // 'md'
            classNameString += ' px-2 py-1';
            classNameString += ' text-md';
    }

    if (color === 'primary') {
        classNameString += ' border border-transparent bg-indigo-600 leading-6 font-medium text-white shadow-sm hover:bg-indigo-500 focus:outline-none focus:border-indigo-700 focus:shadow-outline-indigo ui__modal-enter';
    }
    else { // default or faded-default
        classNameString += ' border border-gray-300 bg-white leading-6 font-medium text-gray-700 shadow-sm hover:text-gray-500 focus:outline-none focus:border-blue-300 focus:shadow-outline-blue';
    }

    if (color.includes('faded')) {
        classNameString += ' opacity-50';
    }
    if (isFullWidth) {
        classNameString += ' w-full';
    }
    return (
        <button
            disabled={disabled}
            className={classNameString}
            style={{margin: '0.125rem 0.25rem 0.125rem 0'}}
            onClick={onClick}>
            {icon && <span className="icon" dangerouslySetInnerHTML={{__html: icon}}/>}
            {children}
        </button>
    );
};