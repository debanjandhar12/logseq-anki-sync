import React, {FC} from "react";

type MenuArr = {
    title: string;
    onClick: () => void;
}[];

export const LogseqDropdownMenu: FC<{menuArr: MenuArr; children: React.ReactNode}> = ({
    menuArr,
    children,
}) => {
    return (
        <div className="anki_de">
            {children}
            <ul className="menu-list">
                {menuArr.map((item, index) => (
                    <li key={index} onClick={item.onClick}>
                        {item.title}
                    </li>
                ))}
            </ul>
        </div>
    );
};
