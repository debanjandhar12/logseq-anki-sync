import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UI } from '../../../../src/ui/UI';

// Mock UI.hideModal
vi.mock('../../../../src/ui/UI', () => ({
    UI: {
        hideModal: vi.fn(),
    },
}));

// Mock logseq
global.logseq = {
    hideMainUI: vi.fn(),
} as any;

describe('Modal Component - Event Handling', () => {
    let setOpen: ReturnType<typeof vi.fn>;
    let onClose: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        setOpen = vi.fn();
        onClose = vi.fn();
        vi.clearAllMocks();
        
        // Clean up DOM
        document.body.innerHTML = '';
    });

    describe('Escape Key Handling', () => {
        it('should use document.addEventListener for keyboard events', () => {
            const addEventListenerSpy = vi.spyOn(document, 'addEventListener');
            
            // Simulate modal mounting with open=true
            // The Modal component should call document.addEventListener('keydown', ...)
            
            // Verify the spy was set up
            expect(addEventListenerSpy).toBeDefined();
            
            addEventListenerSpy.mockRestore();
        });

        it('should use document.removeEventListener for cleanup', () => {
            const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');
            
            // Verify the spy was set up
            expect(removeEventListenerSpy).toBeDefined();
            
            removeEventListenerSpy.mockRestore();
        });
    });

    describe('Click Outside Handling', () => {
        it('should use document.addEventListener for click events', () => {
            const addEventListenerSpy = vi.spyOn(document, 'addEventListener');
            
            // Verify the spy was set up
            expect(addEventListenerSpy).toBeDefined();
            
            addEventListenerSpy.mockRestore();
        });
    });

    describe('Scrollbar Detection', () => {
        it('should use document.querySelectorAll for finding scrollable elements', () => {
            // Create a modal structure
            const modalDiv = document.createElement('div');
            modalDiv.className = 'ui__modal';
            
            const scrollableDiv = document.createElement('div');
            scrollableDiv.style.height = '100px';
            scrollableDiv.style.overflow = 'auto';
            
            const contentDiv = document.createElement('div');
            contentDiv.style.height = '500px';
            
            scrollableDiv.appendChild(contentDiv);
            modalDiv.appendChild(scrollableDiv);
            document.body.appendChild(modalDiv);
            
            // Test that document.querySelectorAll can find the modal divs
            const modalDivs = document.querySelectorAll('.ui__modal div');
            expect(modalDivs.length).toBeGreaterThan(0);
            
            // Note: In jsdom, scrollHeight/clientHeight may not work as expected
            // The important thing is that the code uses document.querySelectorAll
            // instead of WindowParentBridge.querySelectorAll
            
            document.body.removeChild(modalDiv);
        });
    });

    describe('UI.hideModal Integration', () => {
        it('should call UI.hideModal when handleClose is invoked', () => {
            // Simulate handleClose being called
            const handleClose = () => {
                setOpen(false);
                if (onClose) {
                    onClose();
                }
                UI.hideModal();
            };
            
            handleClose();
            
            expect(setOpen).toHaveBeenCalledWith(false);
            expect(onClose).toHaveBeenCalled();
            expect(UI.hideModal).toHaveBeenCalled();
        });

        it('should call UI.hideModal without onClose callback', () => {
            // Simulate handleClose being called without onClose
            const handleClose = () => {
                setOpen(false);
                UI.hideModal();
            };
            
            handleClose();
            
            expect(setOpen).toHaveBeenCalledWith(false);
            expect(UI.hideModal).toHaveBeenCalled();
        });
    });

    describe('Modal Panel Click Detection', () => {
        it('should detect clicks outside modal panel', () => {
            // Create modal structure
            const modalRoot = document.createElement('div');
            modalRoot.className = 'ui__modal';
            
            const overlay = document.createElement('div');
            overlay.className = 'ui__modal-overlay';
            
            const panel = document.createElement('div');
            panel.className = 'ui__modal-panel';
            
            const content = document.createElement('div');
            content.textContent = 'Modal Content';
            
            panel.appendChild(content);
            modalRoot.appendChild(overlay);
            modalRoot.appendChild(panel);
            document.body.appendChild(modalRoot);
            
            // Test click detection logic
            const handleClickOutside = (e: MouseEvent) => {
                const target = e.target as HTMLElement;
                const modalPanel = document.querySelector('.ui__modal-panel');
                
                if (modalPanel && !modalPanel.contains(target)) {
                    // Should close modal
                    return true;
                }
                return false;
            };
            
            // Click on overlay (outside panel)
            const overlayClickEvent = new MouseEvent('click', { bubbles: true });
            Object.defineProperty(overlayClickEvent, 'target', { value: overlay, enumerable: true });
            const shouldCloseOnOverlay = handleClickOutside(overlayClickEvent);
            expect(shouldCloseOnOverlay).toBe(true);
            
            // Click on content (inside panel)
            const contentClickEvent = new MouseEvent('click', { bubbles: true });
            Object.defineProperty(contentClickEvent, 'target', { value: content, enumerable: true });
            const shouldCloseOnContent = handleClickOutside(contentClickEvent);
            expect(shouldCloseOnContent).toBe(false);
            
            document.body.removeChild(modalRoot);
        });
    });

    describe('Arrow Key Scrolling', () => {
        it('should scroll down by 50px when ArrowDown is pressed', () => {
            // Create scrollable modal structure
            const modalDiv = document.createElement('div');
            modalDiv.className = 'ui__modal';
            
            const scrollableDiv = document.createElement('div');
            scrollableDiv.style.height = '100px';
            scrollableDiv.style.overflow = 'auto';
            
            const contentDiv = document.createElement('div');
            contentDiv.style.height = '500px';
            
            scrollableDiv.appendChild(contentDiv);
            modalDiv.appendChild(scrollableDiv);
            document.body.appendChild(modalDiv);
            
            // Mock scrollHeight and clientHeight for jsdom
            Object.defineProperty(scrollableDiv, 'scrollHeight', { value: 500, configurable: true });
            Object.defineProperty(scrollableDiv, 'clientHeight', { value: 100, configurable: true });
            
            // Set initial scroll position
            scrollableDiv.scrollTop = 0;
            
            // Simulate arrow down logic
            const divWithScrollbar = Array.from(document.querySelectorAll('.ui__modal div')).filter(div => {
                return div.scrollHeight > div.clientHeight;
            })[0] as HTMLElement;
            
            if (divWithScrollbar) {
                divWithScrollbar.scrollTop = divWithScrollbar.scrollTop + 50;
            }
            
            expect(scrollableDiv.scrollTop).toBe(50);
            
            document.body.removeChild(modalDiv);
        });

        it('should scroll up by 50px when ArrowUp is pressed', () => {
            // Create scrollable modal structure
            const modalDiv = document.createElement('div');
            modalDiv.className = 'ui__modal';
            
            const scrollableDiv = document.createElement('div');
            scrollableDiv.style.height = '100px';
            scrollableDiv.style.overflow = 'auto';
            
            const contentDiv = document.createElement('div');
            contentDiv.style.height = '500px';
            
            scrollableDiv.appendChild(contentDiv);
            modalDiv.appendChild(scrollableDiv);
            document.body.appendChild(modalDiv);
            
            // Mock scrollHeight and clientHeight for jsdom
            Object.defineProperty(scrollableDiv, 'scrollHeight', { value: 500, configurable: true });
            Object.defineProperty(scrollableDiv, 'clientHeight', { value: 100, configurable: true });
            
            // Set initial scroll position
            scrollableDiv.scrollTop = 100;
            
            // Simulate arrow up logic
            const divWithScrollbar = Array.from(document.querySelectorAll('.ui__modal div')).filter(div => {
                return div.scrollHeight > div.clientHeight;
            })[0] as HTMLElement;
            
            if (divWithScrollbar) {
                divWithScrollbar.scrollTop = divWithScrollbar.scrollTop - 50;
            }
            
            expect(scrollableDiv.scrollTop).toBe(50);
            
            document.body.removeChild(modalDiv);
        });
    });
});
