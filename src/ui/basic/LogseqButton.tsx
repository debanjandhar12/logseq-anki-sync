import React, {FC} from "react";
type LogseqButtonProps = {
    children?: React.ReactNode;
    onClick?: () => void;
    icon?: string;
    isFullWidth?: boolean;
    disabled?: boolean;
    depth?: number;
    title?: string;
    color?: "primary" | "default" | "success" | "link" | "failed";
    size?: "xs" | "sm" | "md" | "lg";
};
export const LogseqButton: FC<LogseqButtonProps> = ({
    children,
    onClick,
    icon,
    isFullWidth,
    color = "default",
    disabled,
    size = "md",
    depth = 0,
    title,
}) => {
    let classNameString =
        "inline-flex justify-center reduce-opacity-when-disabled not-allowed-cursor-when-disabled";
    classNameString += " ui__button ";
    classNameString += ` ui__button-depth-${depth} `;

    if (color === "primary") {
        classNameString += " ui__button-theme-color ui__button-color-custom ";
    } else if (color === "link") {
        classNameString +=
            " ui__button-theme-text border border-transparent bg-indigo-600 font-medium shadow-sm hover:bg-indigo-500 focus:outline-none focus:border-indigo-700 focus:shadow-outline-indigo anki_ui_link_button ";
    } else if (color === "success") {
        classNameString += " ui__button-theme-color ui__button-color-green ";
    } else if (color === "failed") {
        classNameString += " ui__button-theme-color ui__button-color-red ";
    } else if (color === "default") {
        classNameString += " ui__button-theme-color ui__button-color-gray ";
    }

    switch (size) {
        case "xs":
            classNameString += " px-0 py-0 ";
            classNameString += " text-xs ";
            break;
        case "lg":
            classNameString += " px-4 py-2 ";
            classNameString += " text-lg leading-6 ";
            break;
        case "sm":
        default:
            classNameString += ` ui__button-size-${size} `;
    }

    if (isFullWidth) {
        classNameString += " w-full";
    }

    return (
        <button
            disabled={disabled}
            className={classNameString}
            style={{margin: "0.25rem 0.25rem 0.125rem 0.25rem"}}
            title={title}
            onClick={onClick}>
            {icon && <span className="icon" dangerouslySetInnerHTML={{__html: icon}} />}
            {children}
        </button>
    );
};
