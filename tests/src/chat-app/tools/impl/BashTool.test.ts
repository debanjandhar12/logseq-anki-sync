import {afterEach, describe, expect, test, vi} from "vitest";
import {BashTool} from "../../../../../src/chat-app/tools/impl/BashTool";
import {JustBashWrapper} from "../../../../../src/core/just-bash-wrapper";

describe("BashTool", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    test("returns invalid shell exit codes as command failure data", async () => {
        vi.spyOn(JustBashWrapper, "createExecutionInstance").mockResolvedValue({
            exec: async () => ({stdout: "", stderr: "", exitCode: Number.NaN})
        } as unknown as Awaited<ReturnType<typeof JustBashWrapper.getInstance>>);

        const response = await new BashTool().execute({command: "python -c 'pass'"});

        expect(response.result).toMatchObject({success: true, exitCode: 1});
        expect(response.result).toHaveProperty(
            "stderr",
            "bash: Bash returned an invalid exit code\n"
        );
    });
});
