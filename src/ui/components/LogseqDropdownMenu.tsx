import type {FC} from "../React";
// biome-ignore lint/style/useImportType: required for re-exported react
import React from "../React";
import {LogseqPopover} from "./LogseqPopover";

type MenuArr = {
    title: string;
    onClick: () => void;
}[];

export const LogseqDropdownMenu: FC<{menuArr: MenuArr; children: React.ReactNode}> = ({
    menuArr,
    children
}) => {
    return (
        <LogseqPopover
            content={
                <ul
                    className="menu-list"
                    style={{
                        fontSize: "10px",
                        boxShadow:
                            "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
                        borderRadius: "0.25rem",
                        listStyle: "none",
                        overflow: "hidden",
                        margin: 0,
                        padding: 0,
                        backgroundColor: "var(--ls-primary-background-color, #fff)",
                        width: "200px"
                    }}>
                    {menuArr.map((item, index) => (
                        <li
                            key={index}
                            onClick={item.onClick}
                            style={{padding: "5px", userSelect: "none", cursor: "pointer"}}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor =
                                    "var(--ls-quaternary-background-color, #ddd)";
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = "transparent";
                            }}>
                            {item.title}
                        </li>
                    ))}
                </ul>
            }>
            {children}
        </LogseqPopover>
    );
};
