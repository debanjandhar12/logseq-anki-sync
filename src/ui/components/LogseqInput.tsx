import React from "react";

type LogseqInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
    invalid?: boolean;
};

export const LogseqInput = React.forwardRef<HTMLInputElement, LogseqInputProps>(
    ({invalid = false, style, ...props}, ref) => (
        <input
            ref={ref}
            {...props}
            aria-invalid={invalid || undefined}
            className="w-full rounded px-3 py-2 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-60"
            style={{
                backgroundColor:
                    "var(--lx-gray-03, var(--ls-primary-background-color, transparent))",
                borderColor: invalid
                    ? "var(--ls-error-color, #ef4444)"
                    : "var(--lx-gray-06, var(--ls-quaternary-background-color, var(--rx-gray-06)))",
                borderRadius: "0.25rem",
                borderWidth: "1px",
                borderStyle: "solid",
                color: "var(--ls-primary-text-color, inherit)",
                ...style
            }}
        />
    )
);
