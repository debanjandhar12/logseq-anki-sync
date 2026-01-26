import { describe, expect, test, beforeEach, vi } from "vitest";
import { UI } from "../../../src/ui/UI";
import React from "react";

// Mock logseq global
global.logseq = {
    showMainUI: vi.fn(),
    hideMainUI: vi.fn(),
    Editor: {
        getEditingCursorPosition: vi.fn(),
    },
    UI: {
        resolveThemeCssPropsVals: vi.fn(),
    },
    App: {
        onThemeChanged: vi.fn(),
        onThemeModeChanged: vi.fn(),
        getUserConfigs: vi.fn().mockResolvedValue({ preferredThemeMode: 'light' }),
    },
    on: vi.fn(),
} as any;

describe("UI Mounting System", () => {
    beforeEach(() => {
        // Create app root element
        const appRoot = document.createElement('div');
        appRoot.id = 'app';
        document.body.appendChild(appRoot);
        
        // Clear mocks
        vi.clearAllMocks();
    });

    test("showModal should render component and call logseq.showMainUI", async () => {
        const testComponent = React.createElement('div', { id: 'test-component' }, 'Test Content');
        
        await UI.showModal(testComponent);
        
        expect(logseq.showMainUI).toHaveBeenCalled();
        const appRoot = document.getElementById('app');
        expect(appRoot).toBeTruthy();
    });

    test("showModal should apply centered positioning when no position provided", async () => {
        const testComponent = React.createElement('div', {}, 'Test');
        
        await UI.showModal(testComponent);
        
        const appRoot = document.getElementById('app');
        expect(appRoot?.style.position).toBe('fixed');
        expect(appRoot?.style.left).toBe('50%');
        expect(appRoot?.style.top).toBe('15%');
        expect(appRoot?.style.transform).toBe('translate3d(-50%, 0, 0)');
    });

    test("showModal should apply absolute positioning when position provided", async () => {
        const testComponent = React.createElement('div', {}, 'Test');
        const position = { left: 100, top: 200 };
        
        await UI.showModal(testComponent, position);
        
        const appRoot = document.getElementById('app');
        expect(appRoot?.style.position).toBe('absolute');
        expect(appRoot?.style.left).toBe('100px');
        expect(appRoot?.style.top).toBe('200px');
        expect(appRoot?.style.transform).toBe('unset');
    });

    test("hideModal should call logseq.hideMainUI with restoreEditingCursor", () => {
        UI.hideModal();
        
        expect(logseq.hideMainUI).toHaveBeenCalledWith({ restoreEditingCursor: true });
    });

    test("getCursorPosition should return cursor position from logseq", async () => {
        const mockPosition = { left: 50, top: 100, rect: { left: 10, top: 20 } };
        (logseq.Editor.getEditingCursorPosition as any).mockResolvedValue(mockPosition);
        
        const result = await UI.getCursorPosition();
        
        expect(result).toEqual(mockPosition);
    });

    test("getCursorPosition should return null on error", async () => {
        (logseq.Editor.getEditingCursorPosition as any).mockRejectedValue(new Error('Test error'));
        
        const result = await UI.getCursorPosition();
        
        expect(result).toBeNull();
    });
});
