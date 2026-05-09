import React from "../React";

type LogseqSelectProps = {
    value: string | number;
    onChange: (value: string) => void;
    options: Array<{value: string | number; label: string}>;
    title?: string;
    size?: "sm" | "md" | "lg";
    width?: string;
};

export const LogseqSelect = React.forwardRef<HTMLSelectElement, LogseqSelectProps>(
    ({value, onChange, options, title, size = "md", width = "auto"}, ref) => {
        let height = "auto";
        let fontSize = "0.875rem";
        let padding = "0.375rem 0.75rem";

        if (size === "sm") {
            height = "1.75rem";
            fontSize = "0.75rem";
            padding = "0.125rem 0.5rem";
        } else if (size === "lg") {
            height = "2.5rem";
            fontSize = "1rem";
            padding = "0.5rem 1rem";
        }

        return (
            <div style={{position: "relative", width, height}}>
                {title && (
                    <span
                        style={{
                            position: "absolute",
                            zIndex: 2,
                            marginTop: size === "sm" ? "-6px" : "-8px",
                            fontSize: size === "sm" ? "10px" : "12px",
                            userSelect: "none",
                            pointerEvents: "none",
                            opacity: 0.8
                        }}>
                        {title}
                    </span>
                )}
                <select
                    ref={ref}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className={"focus-visible:ring-2"}
                    style={{
                        position: "absolute",
                        zIndex: 1,
                        margin: 0,
                        width: "100%",
                        height: "100%",
                        backgroundColor:
                            "var(--lx-gray-03, var(--ls-primary-background-color, transparent))",
                        backgroundRepeat: "no-repeat",
                        borderColor:
                            "var(--lx-gray-06, var(--ls-quaternary-background-color, var(--rx-gray-06)))",
                        borderRadius: "0.25rem",
                        borderWidth: "1px",
                        borderStyle: "solid",
                        color: "var(--ls-primary-text-color, inherit)",
                        fontSize,
                        padding,
                        cursor: "pointer",
                        outline: "none"
                    }}
                    onFocus={(e) => {
                        e.target.style.borderColor = "var(--primary, #000)";
                    }}
                    onBlur={(e) => {
                        e.target.style.borderColor =
                            "var(--lx-gray-06, var(--ls-quaternary-background-color, var(--rx-gray-06)))";
                    }}>
                    {options.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                            {opt.label}
                        </option>
                    ))}
                </select>
            </div>
        );
    }
);
