import React from "../ui/React";
import {LogseqCheckbox} from "../ui/components/LogseqCheckbox";

export const App = () => {
    const [checked, setChecked] = React.useState(true);
    return (
        <div style={{height: "calc(100vh - 128px)", margin: "0px", padding: "0px"}}>
            Hi
            <LogseqCheckbox checked={checked} onChange={(e) => setChecked(!checked)} children={<text>Hi</text>} />
        </div>
    );
};