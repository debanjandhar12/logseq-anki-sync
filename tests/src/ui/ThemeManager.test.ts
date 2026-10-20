import {afterEach, expect, test, vi} from "vitest";
import {LOGSEQ_THEME_VARIABLES} from "../../../src/ui/theme/constants";
import {ThemeManager} from "../../../src/ui/theme/ThemeManager";

vi.mock("../../../src/logger", () => ({
    createLogger: () => ({warn: vi.fn(), error: vi.fn()}),
    LoggerCategory: {UI: "UI"}
}));

afterEach(() => vi.unstubAllGlobals());

test.each([
    {"--ls-primary-background-color": "#002b36", "--ls-popover-text-color": "#eee"},
    {"--background": "0 0% 100%", "--foreground": "222.2 84% 4.9%"}
])("applies legacy and semantic theme snapshots without changing their format", async (values) => {
    const resolveThemeCssPropsVals = vi.fn().mockResolvedValue(values);
    vi.stubGlobal("logseq", {UI: {resolveThemeCssPropsVals}});
    const body = document.createElement("div");
    await ThemeManager.applyThemeToBody(body);
    expect(resolveThemeCssPropsVals).toHaveBeenCalledWith(LOGSEQ_THEME_VARIABLES);
    for (const [name, value] of Object.entries(values)) {
        expect(body.style.getPropertyValue(name)).toBe(value);
    }
});

test.each([
    null,
    new Error("Unavailable host API")
])("an unavailable theme leaves existing styles intact", async (result) => {
    const resolveThemeCssPropsVals = vi.fn();
    if (result instanceof Error) resolveThemeCssPropsVals.mockRejectedValue(result);
    else resolveThemeCssPropsVals.mockResolvedValue(result);
    vi.stubGlobal("logseq", {UI: {resolveThemeCssPropsVals}});
    const body = document.createElement("div");
    body.style.setProperty("--ls-primary-background-color", "#123456");
    await ThemeManager.applyThemeToBody(body);
    expect(body.style.getPropertyValue("--ls-primary-background-color")).toBe("#123456");
});

test("the inventory covers host tokens in UI styles and every fallback branch", () => {
    const paths = [
        "src/ui/theme/tailwind.config.mjs",
        "src/ui/styles/main.css",
        "src/ui/components/LogseqInput.tsx",
        "src/ui/components/LogseqSelect.tsx",
        "src/ui/components/LogseqTooltip.tsx",
        "src/ui/modals/InputModal.tsx"
    ];
    const inventory = new Set<string>(LOGSEQ_THEME_VARIABLES);
    const missing = new Set<string>();
    for (const path of paths) {
        const sources = import.meta.glob("/src/ui/**/*.{ts,tsx,css,mjs}", {
            query: "?raw",
            import: "default",
            eager: true
        });
        const source = sources[`/${path}`] as string;
        for (const match of source.matchAll(
            /--(?:ls-[\w-]+|lx-[\w-]+|rx-[\w-]+)|(?<=var\()--[\w-]+/g
        )) {
            if (!inventory.has(match[0])) missing.add(match[0]);
        }
    }
    expect([...missing]).toEqual([]);
    expect(inventory.size).toBe(LOGSEQ_THEME_VARIABLES.length);
});

test("surface aliases retain their meaning and fallback chains terminate", async () => {
    // @ts-ignore - this project does not emit declarations for Tailwind's JS configuration
    const {default: config} = await import("../../../src/ui/theme/tailwind.config.mjs");
    const colors = config.theme.extend.colors;
    expect(colors.primary.background).toContain("--ls-primary-background-color");
    expect(colors.primary.background).not.toContain("--ls-button-background");
    expect(colors["button-background"]).toContain("--ls-button-background");
    expect(colors.secondary.background).toContain("--ls-secondary-background-color");
    expect(colors.secondary.border).toContain("--ls-secondary-border-color");
    expect(colors.tertiary.border).toContain("--ls-tertiary-border-color");
    expect(colors.text).toContain("--ls-primary-text-color");
    expect(colors.highlight).toContain("210 40% 96.1%");
    expect(colors.primary.foreground).toContain("--primary-foreground");
});
