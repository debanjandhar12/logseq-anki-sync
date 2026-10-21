import {afterEach, beforeAll, describe, expect, test, vi} from "vitest";
import {
    getTemplateBack,
    getTemplateFront,
    getTemplateMediaFiles
} from "../../../src/anki-template/AnkiCardTemplates";

describe("Anki Card Templates JavaScript Build Tests", () => {
    let templateMediaFiles: ReturnType<typeof getTemplateMediaFiles>;

    beforeAll(() => {
        templateMediaFiles = getTemplateMediaFiles();
    });

    afterEach(() => {
        document.dispatchEvent(new Event("logseq-anki-sync:cleanup:shared"));
        document.dispatchEvent(new Event("logseq-anki-sync:cleanup:side"));
        document.body.innerHTML = "";
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    test("keeps six media assets and Fabric only in the front bundle", () => {
        expect(Object.keys(templateMediaFiles)).toHaveLength(6);
        expect(templateMediaFiles["_logseq_anki_sync.js"]).not.toMatch(/fabric\.js/i);
        expect(templateMediaFiles["_logseq_anki_sync_back.js"]).not.toMatch(/fabric\.js/i);
    });

    test.each([
        "front",
        "back"
    ])("%s markup loads runtimes and dispatches events after the side marker", (side) => {
        const html = side === "front" ? getTemplateFront() : getTemplateBack();
        const marker = html.indexOf(`class="anki-card-${side}-side"`);
        const sharedRuntime = html.indexOf('src="_logseq_anki_sync.js"');
        const sideRuntime = html.indexOf(`src="_logseq_anki_sync_${side}.js"`);
        expect(marker).toBeGreaterThan(-1);
        expect(sharedRuntime).toBeGreaterThan(marker);
        expect(sideRuntime).toBeGreaterThan(sharedRuntime);
        expect(html.indexOf('window.dispatchEvent(new Event("load"))')).toBeGreaterThan(
            sideRuntime
        );
        expect(html.match(/window\.dispatchEvent/g)).toHaveLength(3);
        expect(html).not.toContain("onclick=");
        expect(html).not.toContain("keydownHandler");
    });

    test("bundled shared runtime installs private shortcuts without duplicate listeners", () => {
        document.body.innerHTML = '<div id="main-content"><span class="cloze"></span></div>';
        const scroll = vi.fn();
        document.querySelector(".cloze")!.scrollIntoView = scroll;
        const execute = new Function(templateMediaFiles["_logseq_anki_sync.js"]);
        execute();
        window.dispatchEvent(new Event("load"));
        window.dispatchEvent(new Event("load"));
        execute();
        window.dispatchEvent(new Event("load"));
        document.dispatchEvent(new KeyboardEvent("keydown", {shiftKey: true, keyCode: 74}));
        expect(scroll).toHaveBeenCalledExactlyOnceWith({
            behavior: "smooth",
            block: "center",
            inline: "center"
        });
        expect(window).not.toHaveProperty("openBlockInLogseq");
        expect(window).not.toHaveProperty("scrollToClozeElement");
        expect(window).not.toHaveProperty("flipToBack");
    });

    test("leaves native top/bottom navigation and Shift+L untouched", () => {
        document.body.innerHTML = '<div id="main-content"></div>';
        const scroll = vi.spyOn(window, "scroll").mockImplementation(() => {});
        new Function(templateMediaFiles["_logseq_anki_sync.js"])();
        window.dispatchEvent(new Event("load"));
        for (const options of [
            {key: "Home", keyCode: 36, ctrlKey: true},
            {key: "End", keyCode: 35, ctrlKey: true},
            {key: "ArrowUp", keyCode: 38, metaKey: true},
            {key: "ArrowDown", keyCode: 40, metaKey: true},
            {key: "L", keyCode: 76, shiftKey: true}
        ]) {
            const event = new KeyboardEvent("keydown", {...options, cancelable: true});
            document.dispatchEvent(event);
            expect(event.defaultPrevented).toBe(false);
        }
        expect(scroll).not.toHaveBeenCalled();
    });

    test("bundled front and back runtimes preserve the answer across repeated loads", () => {
        vi.stubGlobal("type", "cloze");
        vi.stubGlobal("pycmd", vi.fn());
        const renderCard = (side: string) => {
            document.body.innerHTML = `<div id="main-content"><span class="cloze">answer</span>
                <span class="type-in-container" style="display:none"><input id="typeans"></span></div>
                <div id="tags" tags_name="type-in"></div><span class="anki-card-${side}-side"></span>`;
            Object.defineProperty(document.querySelector(".cloze"), "innerText", {value: "answer"});
        };
        const execute = (filename: string) => new Function(templateMediaFiles[filename])();
        const load = () => window.dispatchEvent(new Event("load"));
        renderCard("front");
        execute("_logseq_anki_sync.js");
        execute("_logseq_anki_sync_front.js");
        load();
        const input = document.querySelector<HTMLInputElement>("#typeans")!;
        input.value = "answer";
        input.dispatchEvent(new Event("keyup"));
        load();
        input.dispatchEvent(new KeyboardEvent("keydown", {key: "Enter"}));
        expect(localStorage.getItem("logseq-prev-typeans")).toBe("answer");
        renderCard("back");
        execute("_logseq_anki_sync.js");
        execute("_logseq_anki_sync_back.js");
        load();
        load();
        expect(document.querySelector(".typeGood")?.textContent).toBe("answer");
        expect(document.querySelector<HTMLElement>(".type-in-container")?.style.display).toBe(
            "block"
        );
        expect(window).not.toHaveProperty("flipToBack");
        localStorage.clear();
    });

    describe("_logseq_anki_sync_front.js (Front Side JavaScript)", () => {
        let jsContent: string;

        beforeAll(() => {
            jsContent = templateMediaFiles["_logseq_anki_sync_front.js"];
        });

        test("should be valid JavaScript (no syntax errors)", () => {
            expect(() => {
                new Function(jsContent);
            }).not.toThrow();
        });

        test("should contain compiled code from fabric.js", () => {
            expect(jsContent).toMatch(/fabric\.js/i);
        });
    });

    describe("_logseq_anki_sync_back.js (Back Side JavaScript)", () => {
        let jsContent: string;

        beforeAll(() => {
            jsContent = templateMediaFiles["_logseq_anki_sync_back.js"];
        });

        test("should be valid JavaScript (no syntax errors)", () => {
            expect(() => {
                new Function(jsContent);
            }).not.toThrow();
        });
    });

    describe("_logseq_anki_sync.js (Both Side JavaScript)", () => {
        let jsContent: string;

        beforeAll(() => {
            jsContent = templateMediaFiles["_logseq_anki_sync.js"];
        });

        test("should be valid JavaScript (no syntax errors)", () => {
            expect(() => {
                new Function(jsContent);
            }).not.toThrow();
        });
    });
});
