import React, {FC} from "react";

type LogseqButtonProps = {
    children: React.ReactNode,
    onClick?: () => void,
    icon?: string,
    isFullWidth?: boolean,
    color?: 'green' | 'indigo' | 'red' | 'gray'
};

export const LogseqButton: FC<LogseqButtonProps> = ({children, onClick, icon, isFullWidth, color, isCentered}) => {
    let classNameString = `ui__button bg-${color}-600 hover:bg-${color}-700 focus:border-${color}-700 active:bg-${color}-700 text-center text-sm shadow-sm inline-flex rounded-md border border-transparent px-4 py-2 bg-indigo-600 text-base leading-6 font-medium`;

    if (isFullWidth) {
        classNameString += ' w-full';
    }

    if (isCentered){
        classNameString += ' justify-center';
    }

    return (
        <button
            className={classNameString}
            style={{margin: '0.125rem 0.25rem 0.125rem 0', padding: '0.35rem'}}
            onClick={onClick}>
            {icon && <span className="icon" dangerouslySetInnerHTML={{__html: icon}}/>}
            {children}
        </button>
    );
};