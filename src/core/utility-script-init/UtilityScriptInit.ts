import {UtilityScriptStore} from "src/core/stores/utility-script-store/UtilityScriptStore";
import FETCH_TRANSCRIPT_SCRIPT from "./scripts/fetch-transcript/index.ts?string";

const BUILT_IN_SCRIPTS = new Map([
    ["fetch-transcript.js", `#!/usr/bin/env qjs\n${FETCH_TRANSCRIPT_SCRIPT}`]
]);

export class UtilityScriptInit {
    static async init(): Promise<void> {
        for (const [name, content] of BUILT_IN_SCRIPTS) {
            if ((await UtilityScriptStore.getScript(name)) !== content) {
                await UtilityScriptStore.saveScript(name, content);
            }
        }
    }
}
