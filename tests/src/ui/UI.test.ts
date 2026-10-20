import {afterEach, expect, test, vi} from "vitest";
import {ThemeManager} from "../../../src/ui/theme/ThemeManager";
import {UI} from "../../../src/ui/UI";

const callbacks = vi.hoisted(() => ({unload: vi.fn()}));
vi.mock("../../../src/ui/theme/ThemeManager", () => ({
    ThemeManager: {applyThemeToBody: vi.fn()}
}));
vi.mock("../../../src/logseq/LogseqProxy", () => ({
    LogseqProxy: {App: {registerPluginUnloadListener: callbacks.unload}}
}));
vi.mock("../../../src/logseq/WindowBridge", () => ({
    WindowBridge: {getBody: () => document.body, getWindow: () => window}
}));

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
});

test("initializes iframe stacking and refreshes theme on host events", () => {
    vi.useFakeTimers();
    const host = {
        setMainUIInlineStyle: vi.fn(),
        hideMainUI: vi.fn(),
        on: vi.fn(),
        App: {onThemeChanged: vi.fn(), onThemeModeChanged: vi.fn()}
    };
    vi.stubGlobal("logseq", host);
    UI.init();
    expect(host.setMainUIInlineStyle).toHaveBeenCalledWith({zIndex: 10000});
    expect(ThemeManager.applyThemeToBody).toHaveBeenCalledWith(document.body);
    host.App.onThemeChanged.mock.calls[0][0]();
    host.App.onThemeModeChanged.mock.calls[0][0]();
    expect(ThemeManager.applyThemeToBody).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(100);
    expect(ThemeManager.applyThemeToBody).toHaveBeenCalledTimes(3);
    host.on.mock.calls[0][1]({visible: true});
    expect(ThemeManager.applyThemeToBody).toHaveBeenCalledTimes(4);
    host.on.mock.calls[0][1]({visible: false});
    expect(ThemeManager.applyThemeToBody).toHaveBeenCalledTimes(4);
    callbacks.unload.mock.calls[0][0]();
    expect(host.hideMainUI).toHaveBeenCalledTimes(2);
});
