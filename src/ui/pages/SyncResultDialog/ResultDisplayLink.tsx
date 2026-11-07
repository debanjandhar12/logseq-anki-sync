import type {ReactNode} from "react";

/** Inline links and actions, with a distinct error style for error details. */
export function ResultDisplayLink({
    children,
    href,
    onClick,
    variant = "display"
}: {
    children: ReactNode;
    href?: string;
    onClick?: () => void;
    variant?: "display" | "error";
}) {
    const className =
        "inline-flex flex-row items-center ml-1 min-w-0 break-all rounded-[2px] p-0 h-auto select-text cursor-pointer " +
        (variant === "error"
            ? "bg-transparent text-danger underline-offset-2 hover:underline focus-visible:underline"
            : "button bg-inherit hover:bg-secondary-border focus-visible:bg-secondary-border");
    const style = {fontSize: "14px"};
    return href ? (
        <a
            className={className}
            style={style}
            href={href}
            target="_blank"
            rel="noreferrer"
            onClick={onClick}>
            {children}
        </a>
    ) : (
        <button type="button" className={className} style={style} onClick={onClick}>
            {children}
        </button>
    );
}
