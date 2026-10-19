import BILIBILI_TRANSCRIPT from "src/chat-app/prompts/skills/working-with-bash-and-pyodide/examples/BILIBILI_TRANSCRIPT.py?raw";
import READ_SKILL_FILE from "src/chat-app/prompts/skills/working-with-bash-and-pyodide/internal/READ_SKILL_FILE.sh?raw";
import {VIR_ENV_USER_PATH} from "src/constants";
import {initBuiltInSkillFiles} from "src/core/skill-init/initBuiltInSkillFiles";
import {SkillStore} from "src/core/stores/skill-store/SkillStore";
import {parseTemplateString} from "src/core/template-engine/renderer/parseTemplateString";
import {describe, expect} from "vitest";
import {test} from "../../core/logseq-reversible-transaction-tracker/commands/fixtures/bashCommandFixture";

describe("Bash examples embedded in the Bash and Pyodide skill", () => {
    test("reads a skill-store file using the embedded Bash source", async ({sandbox}) => {
        await initBuiltInSkillFiles();
        const skill = await SkillStore.getSkill("working-with-bash-and-pyodide");
        expect(skill?.content).toContain(READ_SKILL_FILE.trim());
        const command = await parseTemplateString(READ_SKILL_FILE, {
            virEnvUserPath: VIR_ENV_USER_PATH
        });
        const {bash, tracker} = sandbox.createCommand(command);
        expect(await tracker.execute()).toEqual({
            stdout: BILIBILI_TRANSCRIPT,
            stderr: "",
            exitCode: 0
        });
        expect(bash.getCommands()).toEqual([]);
        expect(tracker.hasAppliedGraphMutations()).toBe(false);
    });
});
