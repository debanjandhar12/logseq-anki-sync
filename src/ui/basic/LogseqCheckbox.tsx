import React, {FC} from "react";

type LogseqCheckboxProps = {
    children: React.ReactNode;
    onChange?: (e?: any) => void;
    disabled?: boolean;
    checked?: boolean;
};

export const LogseqCheckbox: FC<LogseqCheckboxProps> = ({
    children,
    onChange,
    disabled = false,
    checked = false,
}) => {
    return (
        <label style={{display: "flex", alignItems: "center"}}>
            <input
                type="checkbox"
                disabled={disabled}
                checked={checked}
                className="form-checkbox h-4 w-4 transition duration-150 ease-in-out"
                onChange={onChange}
            />
            <span className="html-content pl-1 flex-1 text-sm">{children}</span>
        </label>
    );
};
