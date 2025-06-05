import React, {FC} from "react";
type LogseqButtonProps = {
    children?: React.ReactNode;
    onClick?: () => void;
    icon?: string;
    isFullWidth?: boolean;
    disabled?: boolean;
    depth?: number;
    title?: string;
    color?: "primary" | "default" | "secondary" |"success" | "failed" | "ghost" | "link" | "outline-link";
    size?: "xs" | "sm" | "md" | "lg";
};

export const LogseqButton: FC<LogseqButtonProps> = ({
                                                        children,
                                                        onClick,
                                                        icon,
                                                        isFullWidth,
                                                        color = "secondary",
                                                        disabled,
                                                        size = "md",
                                                        depth = 0,
                                                        title,
                                                    }) => {
    let classNameString =
        "ui__button inline-flex items-center justify-center whitespace-nowrap text-sm gap-1 font-medium transition-colors ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none";
    classNameString += ` ui__button-depth-${depth} `;

    if (color === "primary" || color == "default") {
        classNameString += " bg-primary/90 hover:bg-primary/100 active:opacity-90 text-primary-foreground as-classic";
    } else if (color === "secondary") {
        classNameString += "bg-background hover:bg-accent active:opacity-80 as-outline border";
    } else if (color === "failed") {
        classNameString += " bg-destructive/90 hover:bg-destructive/100 active:opacity-90 text-destructive-foreground as-destructive";
    } else if (color === "success") {
        classNameString += " bg-primary/90 hover:bg-primary/100 active:opacity-90 text-primary-foreground as-classic primary-green";
    } else if (color === "ghost") {
        classNameString += " hover:bg-secondary/70 hover:text-secondary-foreground active:opacity-80 as-ghost";
    } else if (color === "link") {
        classNameString += " text-primary underline-offset-4 hover:underline active:opacity-80 as-link";
    } else if (color === "outline-link") {
        classNameString += " anki_ui_link_button active:opacity-90 border bg-background";
    }

    if (size === "xs") {
        classNameString += " px-2 py-1 text-xs rounded h-6";
    }
    else if (size === "sm") {
        classNameString += " px-2 py-1 text-sm rounded h-7";
    }
    else if (size === "lg") {
        classNameString += " px-4 py-3 text-lg rounded h-11";
    }
    else if (size === "md") {
        classNameString += " px-3 py-1 text-md rounded h-7";
    }

    if (isFullWidth) {
        classNameString += " w-full";
    }

    return (
        <div style={{margin: "0.25rem"}} className={'flex w-full rounded-md shadow-sm sm:ml-3 sm:w-auto'}>
            <button
                disabled={disabled}
                className={classNameString}
                title={title}
                onClick={onClick}>
                {icon && <span className="ui__icon ti" dangerouslySetInnerHTML={{__html:icon}}></span>}
                {children}
            </button>
        </div>
    );
};