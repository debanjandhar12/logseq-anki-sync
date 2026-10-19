import {describe, expect, test} from "vitest";
import {renderCommandFileTemplate} from "../../../../src/core/command-parser";

describe("renderCommandFileTemplate", () => {
    test.each([
        "\n",
        "\r\n"
    ])("returns only the rendered body with %j newlines", async (newline) => {
        const source = [
            "---",
            "name: <% today %>",
            "invoke-location:",
            "  - Block Slash Command",
            "---",
            "Ask about <% today %>"
        ].join(newline);

        await expect(renderCommandFileTemplate(source, {today: "rendered"} as never)).resolves.toBe(
            "Ask about rendered"
        );
    });

    test("supports an empty body", async () => {
        await expect(
            renderCommandFileTemplate(
                "---\nname: Empty\ninvoke-location:\n  - Block Slash Command\n---",
                {} as never
            )
        ).resolves.toBe("");
    });

    test.each([
        "\n",
        "\r\n"
    ])("preserves Logseq macros while rendering template variables with %j newlines", async (newline) => {
        const body =
            "For <% today %>: {{video URL}} {{youtube-timestamp 263}} {{youtube-timestamp ...}}";
        const source = [
            "---",
            "name: Transcribe",
            "invoke-location:",
            "  - Block Context Menu/Video",
            "---",
            body
        ].join(newline);
        await expect(renderCommandFileTemplate(source, {today: "today"} as never)).resolves.toBe(
            "For today: {{video URL}} {{youtube-timestamp 263}} {{youtube-timestamp ...}}"
        );
    });
});
