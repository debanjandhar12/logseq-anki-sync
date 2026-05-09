import type {FC} from "../React";
// biome-ignore lint/style/useImportType: required for re-exported react
import React from "../React";

type LogseqButtonProps = {
    children?: React.ReactNode;
    onClick?: () => void;
    icon?: string;
    isFullWidth?: boolean;
    disabled?: boolean;
    depth?: number;
    title?: string;
    color?:
        | "primary"
        | "default"
        | "secondary"
        | "success"
        | "failed"
        | "ghost"
        | "link"
        | "outline-link";
    size?: "xs" | "sm" | "md" | "lg";
};

export const LogseqButton: FC<LogseqButtonProps> = ({
    children,
    onClick,
    icon,
    isFullWidth,
    color = "primary",
    disabled,
    size = "md",
    depth = 0,
    title
}) => {
    let classNameString =
        "ui__button transition-colors transition-opacity inline-flex items-center justify-center whitespace-nowrap text-sm gap-1 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none";

    // Color variants using Tailwind color aliases
    if (color === "primary" || color === "default") {
        classNameString += " bg-primary hover:opacity-80 text-white";
    } else if (color === "secondary") {
        classNameString += " bg-secondary hover:opacity-80 text-white";
    } else if (color === "failed") {
        classNameString += " bg-red-600 hover:bg-red-700 text-white";
    } else if (color === "success") {
        classNameString += " bg-green-600 hover:bg-green-700 text-white";
    } else if (color === "ghost") {
        classNameString += " hover:bg-tertiary-background hover:opacity-80 text-text";
    } else if (color === "link") {
        classNameString += " text-primary underline-offset-4 hover:underline";
    } else if (color === "outline-link") {
        classNameString += " bg-transparent border border-border opacity-80 hover:opacity-100";
    }

    // Size variants
    if (size === "xs") {
        classNameString += " px-2 py-1 text-xs rounded h-6";
    } else if (size === "sm") {
        classNameString += " px-2 py-1 text-sm rounded h-7";
    } else if (size === "lg") {
        classNameString += " px-4 py-3 text-lg rounded h-11";
    } else if (size === "md") {
        classNameString += " px-3 py-1 text-md rounded h-7";
    }

    if (isFullWidth) {
        classNameString += " w-full";
    }

    return (
        <div style={{margin: "0.25rem"}} className={"flex rounded-md shadow-sm sm:ml-3 sm:w-auto"}>
            <button disabled={disabled} className={classNameString} title={title} onClick={onClick}>
                {icon && (
                    <span className="ui__icon ti" dangerouslySetInnerHTML={{__html: icon}}></span>
                )}
                {children}
            </button>
        </div>
    );
};
