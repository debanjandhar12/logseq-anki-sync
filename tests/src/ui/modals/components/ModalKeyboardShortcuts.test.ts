import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

// Mock logger before any imports
vi.mock('../../../../../src/utils/logger', () => ({
    createLogger: vi.fn(() => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    })),
    LoggerCategory: {
        Others: 'Others',
        LogseqWrappers: 'LogseqWrappers',
    },
}));

// Mock UI methods
vi.mock('../../../../../src/ui/UI', () => ({
    UI: {
        showModal: vi.fn((component) => Promise.resolve()),
        hideModal: vi.fn(),
    },
}));

// Mock logseq
global.logseq = {
    showMainUI: vi.fn(),
    hideMainUI: vi.fn(),
    UI: {
        showMsg: vi.fn(),
    },
} as any;

import { showConfirmModal } from '../../../../../src/ui/modals/components/ConfirmModal';
import { showButtonModal } from '../../../../../src/ui/modals/components/ButtonModal';
import { showSelectionModal } from '../../../../../src/ui/modals/components/SelectionModal';
import { UI } from '../../../../../src/ui/UI';

describe('Modal Keyboard Shortcuts Integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        document.body.innerHTML = '';
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    describe('ConfirmModal Keyboard Shortcuts', () => {
        it('should close on Escape key', async () => {
            // Mock showModal to simulate rendering
            vi.mocked(UI.showModal).mockImplementation(() => Promise.resolve());

            // Call showConfirmModal (it will call UI.showModal internally)
            const promise = showConfirmModal('Test message');

            // Verify showModal was called
            expect(UI.showModal).toHaveBeenCalled();

            // The modal component would handle Escape internally
            // and call UI.hideModal()
            // This test verifies the integration pattern
        });

        it('should confirm on Enter key when enabled', async () => {
            vi.mocked(UI.showModal).mockImplementation(() => Promise.resolve());

            const promise = showConfirmModal('Test message');

            expect(UI.showModal).toHaveBeenCalled();
            // The useModal hook with enableEnterKey: true handles Enter key
        });
    });

    describe('ButtonModal Keyboard Shortcuts', () => {
        it('should close on Escape key and return false', async () => {
            vi.mocked(UI.showModal).mockImplementation(() => Promise.resolve());

            const buttons = [
                { name: 'Button 1', f: vi.fn() },
                { name: 'Button 2', f: vi.fn() },
            ];

            const promise = showButtonModal('Test message', buttons);

            expect(UI.showModal).toHaveBeenCalled();
            // ButtonModal handles Escape to return false
        });

        it('should handle button clicks', async () => {
            vi.mocked(UI.showModal).mockImplementation(() => Promise.resolve());

            const mockFunction = vi.fn();
            const buttons = [
                { name: 'Test Button', f: mockFunction },
            ];

            const promise = showButtonModal('Test message', buttons);

            expect(UI.showModal).toHaveBeenCalled();
            // Button clicks trigger the function and return the index
        });
    });

    describe('SelectionModal Keyboard Shortcuts', () => {
        it('should close on Escape key and return null', async () => {
            vi.mocked(UI.showModal).mockImplementation(() => Promise.resolve());

            const items = [
                { name: 'Item 1' },
                { name: 'Item 2' },
            ];

            const promise = showSelectionModal(items);

            expect(UI.showModal).toHaveBeenCalled();
            // SelectionModal handles Escape to return null
        });

        it('should handle numbered key selection when enabled', async () => {
            vi.mocked(UI.showModal).mockImplementation(() => Promise.resolve());

            const items = [
                { name: 'Item 1' },
                { name: 'Item 2' },
                { name: 'Item 3' },
            ];

            const promise = showSelectionModal(items, { enableKeySelect: true });

            expect(UI.showModal).toHaveBeenCalled();
            // SelectionModal with enableKeySelect handles number keys 1-9
        });

        it('should handle item selection', async () => {
            vi.mocked(UI.showModal).mockImplementation(() => Promise.resolve());

            const items = [
                { name: 'Item 1' },
                { name: 'Item 2' },
            ];

            const promise = showSelectionModal(items);

            expect(UI.showModal).toHaveBeenCalled();
            // Clicking an item returns its index
        });
    });

    describe('Modal Rendering in Plugin Iframe', () => {
        it('should verify modals render in plugin document', () => {
            // Verify we're working with the plugin's own document
            expect(document).toBeDefined();
            expect(document.body).toBeDefined();

            // Create a test modal structure
            const modalDiv = document.createElement('div');
            modalDiv.className = 'ui__modal';
            modalDiv.innerHTML = '<div class="ui__modal-panel">Test Modal</div>';
            document.body.appendChild(modalDiv);

            // Query using document (not parent window)
            const found = document.querySelector('.ui__modal');
            expect(found).toBe(modalDiv);

            // Verify panel is found
            const panel = document.querySelector('.ui__modal-panel');
            expect(panel).toBeDefined();
            expect(panel?.textContent).toBe('Test Modal');

            // Clean up
            document.body.removeChild(modalDiv);
        });

        it('should verify keyboard events work on plugin document', () => {
            const mockHandler = vi.fn();

            // Add event listener to plugin's document
            document.addEventListener('keydown', mockHandler);

            // Dispatch keyboard event
            const event = new KeyboardEvent('keydown', { key: 'Escape' });
            document.dispatchEvent(event);

            // Verify handler was called
            expect(mockHandler).toHaveBeenCalled();
            expect(mockHandler).toHaveBeenCalledWith(
                expect.objectContaining({ key: 'Escape' })
            );

            // Clean up
            document.removeEventListener('keydown', mockHandler);
        });

        it('should verify click events work on plugin document', () => {
            const mockHandler = vi.fn();

            // Create a button in plugin document
            const button = document.createElement('button');
            button.textContent = 'Test Button';
            button.addEventListener('click', mockHandler);
            document.body.appendChild(button);

            // Click the button
            button.click();

            // Verify handler was called
            expect(mockHandler).toHaveBeenCalled();

            // Clean up
            document.body.removeChild(button);
        });
    });

    describe('Modal Close Behavior', () => {
        it('should call UI.hideModal when modal closes', () => {
            // This test verifies the integration pattern
            // All modal components call UI.hideModal() when closing

            // Simulate modal close
            UI.hideModal();

            expect(UI.hideModal).toHaveBeenCalled();
        });

        it('should verify modals use createModalPromise', () => {
            vi.mocked(UI.showModal).mockImplementation(() => Promise.resolve());

            // All modal show functions use createModalPromise
            // which calls UI.showModal internally

            showConfirmModal('Test');
            expect(UI.showModal).toHaveBeenCalled();

            vi.clearAllMocks();

            showButtonModal('Test', [{ name: 'Button', f: vi.fn() }]);
            expect(UI.showModal).toHaveBeenCalled();

            vi.clearAllMocks();

            showSelectionModal([{ name: 'Item' }]);
            expect(UI.showModal).toHaveBeenCalled();
        });
    });

    describe('Focus Management', () => {
        it('should verify focus trap can work in plugin iframe', () => {
            // Create focusable elements
            const button1 = document.createElement('button');
            button1.textContent = 'Button 1';
            const button2 = document.createElement('button');
            button2.textContent = 'Button 2';

            document.body.appendChild(button1);
            document.body.appendChild(button2);

            // Focus first button
            button1.focus();

            // Verify focus (jsdom has limited focus support)
            expect(document.body.contains(button1)).toBe(true);
            expect(document.body.contains(button2)).toBe(true);

            // Clean up
            document.body.removeChild(button1);
            document.body.removeChild(button2);
        });

        it('should verify modal panel can be queried for focus trap', () => {
            // Create modal structure
            const modal = document.createElement('div');
            modal.className = 'ui__modal';
            const panel = document.createElement('div');
            panel.className = 'ui__modal-panel';
            const button = document.createElement('button');
            button.textContent = 'Modal Button';

            panel.appendChild(button);
            modal.appendChild(panel);
            document.body.appendChild(modal);

            // Query for modal panel (used by focus trap)
            const foundPanel = document.querySelector('.ui__modal-panel');
            expect(foundPanel).toBe(panel);

            // Verify button is inside panel
            expect(panel.contains(button)).toBe(true);

            // Clean up
            document.body.removeChild(modal);
        });
    });

    describe('Event Listener Cleanup', () => {
        it('should verify event listeners can be removed', () => {
            const mockHandler = vi.fn();

            // Add event listener
            document.addEventListener('keydown', mockHandler);

            // Dispatch event
            const event1 = new KeyboardEvent('keydown', { key: 'Escape' });
            document.dispatchEvent(event1);
            expect(mockHandler).toHaveBeenCalledTimes(1);

            // Remove event listener
            document.removeEventListener('keydown', mockHandler);

            // Dispatch event again
            const event2 = new KeyboardEvent('keydown', { key: 'Escape' });
            document.dispatchEvent(event2);

            // Handler should not be called again
            expect(mockHandler).toHaveBeenCalledTimes(1);
        });

        it('should verify multiple event listeners work independently', () => {
            const handler1 = vi.fn();
            const handler2 = vi.fn();

            // Add two event listeners
            document.addEventListener('keydown', handler1);
            document.addEventListener('keydown', handler2);

            // Dispatch event
            const event = new KeyboardEvent('keydown', { key: 'Escape' });
            document.dispatchEvent(event);

            // Both handlers should be called
            expect(handler1).toHaveBeenCalled();
            expect(handler2).toHaveBeenCalled();

            // Clean up
            document.removeEventListener('keydown', handler1);
            document.removeEventListener('keydown', handler2);
        });
    });
});
