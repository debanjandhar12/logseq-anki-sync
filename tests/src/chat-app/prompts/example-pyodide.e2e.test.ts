import BILIBILI_TRANSCRIPT from "src/chat-app/prompts/skills/working-with-bash-and-pyodide/examples/BILIBILI_TRANSCRIPT.py?raw";
import {VIR_ENV_USER_PATH} from "src/constants";
import {initBuiltInSkillFiles} from "src/core/skill-init/initBuiltInSkillFiles";
import {SkillStore} from "src/core/stores/skill-store/SkillStore";
import {describe, expect} from "vitest";
import {test} from "../../core/logseq-reversible-transaction-tracker/commands/fixtures/bashCommandFixture";

describe("Installed Bash and Pyodide examples", () => {
    test("fetches the public Bilibili transcript using the installed Python script", async ({
        sandbox
    }) => {
        await initBuiltInSkillFiles();
        const files = await SkillStore.getSkillFiles("working-with-bash-and-pyodide");
        expect(files["examples/BILIBILI_TRANSCRIPT.py"]).toBe(BILIBILI_TRANSCRIPT);
        const {bash, tracker} = sandbox.createCommand(
            `python ${VIR_ENV_USER_PATH}/skills/working-with-bash-and-pyodide/examples/BILIBILI_TRANSCRIPT.py`
        );
        const result = await tracker.execute();
        expect(result.exitCode, result.stderr).toBe(0);
        expect(result.stderr).toBe("");
        const segments = JSON.parse(result.stdout.trim().split("\n").at(-1)!);
        expect(segments.length).toBeGreaterThan(0);
        for (const segment of segments) {
            expect(segment).toMatchObject({
                from: expect.any(Number),
                to: expect.any(Number),
                content: expect.any(String)
            });
            expect(segment.to).toBeGreaterThanOrEqual(segment.from);
        }
        expect(segments[0].content).toContain("算法");
        expect(bash.getCommands()).toEqual([]);
    }, 180_000);
});
