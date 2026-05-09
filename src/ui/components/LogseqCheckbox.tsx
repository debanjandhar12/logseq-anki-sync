import React, {type FC, useEffect, useRef} from "../React";

type LogseqCheckboxProps = {
    children?: React.ReactNode;
    onChange?: (e?: any) => void;
    disabled?: boolean;
    checked?: boolean;
    indeterminate?: boolean;
};

export const LogseqCheckbox: FC<LogseqCheckboxProps> = ({
    children,
    onChange,
    disabled = false,
    checked = false,
    indeterminate = false
}) => {
    const checkboxRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (checkboxRef.current) {
            checkboxRef.current.indeterminate = indeterminate;
        }
    }, [indeterminate]);

    return (
        <label style={{display: "flex", alignItems: "center"}}>
            <input
                type="checkbox"
                disabled={disabled}
                checked={checked}
                className="form-checkbox h-4 w-4 transition duration-150 ease-in-out"
                style={{
                    borderRadius: "calc(var(--radius) - 4px)",
                    accentColor: "var(--primary)"
                }}
                onChange={onChange}
                ref={checkboxRef}
            />
            <span className="html-content pl-1 flex-1 text-sm">{children}</span>
        </label>
    );
};
