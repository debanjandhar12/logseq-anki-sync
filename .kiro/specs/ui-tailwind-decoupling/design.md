# Design Document: UI Tailwind Decoupling

## Overview

This design addresses the critical issue of UI breakage when Logseq updates its Tailwind CSS classes. The plugin currently injects React components into Logseq's parent window DOM using `logseq.provideUI()`, making them dependent on Logseq's compiled Tailwind CSS. When Logseq removes or changes these classes, the plugin UI breaks.

After analyzing the logseq-assets-plus-main example plugin, **we recommend switching from `logseq.provideUI()` to `logseq.showMainUI()`** with bundled Tailwind CSS. This provides complete style isolation, future-proofs the plugin against Logseq changes, and is the proven pattern used by successful Logseq plugins.

### Current Architecture

The plugin uses:
- **UI Mounting**: `UI.mountReactComponentInLogseq()` wraps `logseq.provideUI()` and `ReactDOM.render()`
- **Component Structure**: 20+ React components in `src/ui/` (modals, pages, common components)
- **Styling**: Extensive Tailwind utility classes (flex, grid, spacing, colors, borders, shadows, opacity, hover, responsive)
- **Theme Integration**: CSS custom properties like `--ls-primary-background-color` accessed via `WindowParentBridge`
- **Parent Window Access**: `WindowParentBridge` for type-safe parent window communication

### Key Architectural Insight

**Logseq plugins already run in an isolated iframe context.** When you use `document` in a plugin, you're accessing the plugin's own document, not Logseq's parent window. The issue is that `logseq.provideUI()` injects elements into the parent window's DOM, making them dependent on parent window styles.

### Scope

**In Scope:**
- All UI components in `src/ui/` directory
- Modal dialogs (Modal, ConfirmModal, ButtonModal, SelectionModal, DialogModal)
- Pages (OcclusionEditor, SyncResultDialog, SyncSelectionDialog, FeatureExplorer)
- Common components (LogseqButton, LogseqCheckbox, LogseqDropdownMenu, Notification)
- Progress notifications
- Theme variable access
- Focus management and keyboard shortcuts
- Positioning logic for modals

**Out of Scope:**
- Anki card templates (separate styling system)
- Logseq block rendering (uses Logseq's native rendering)
- Plugin settings UI (managed by Logseq)
- Toolbar button (uses `logseq.App.registerUIItem` - stays as is)

## Architecture

### Recommended Approach: `logseq.showMainUI()` with Bundled Tailwind CSS

The solution is to switch from `logseq.provideUI()` (which injects into parent window) to `logseq.showMainUI()` (which shows the plugin's own iframe). The plugin already runs in an isolated iframe - we just need to render our UI there instead of injecting it into the parent.

**Key Benefits:**
1. **Complete Isolation**: Plugin iframe has its own document and styles
2. **Future-Proof**: Immune to Logseq CSS changes
3. **Simple Implementation**: Just import CSS and use showMainUI/hideMainUI
4. **Clean Architecture**: Clear separation between plugin and parent window
5. **Proven Pattern**: Used successfully by logseq-assets-plus-main and other plugins

**Architecture Changes:**

```
Current Flow:
logseq.provideUI() → Inject <div> into parent window DOM → Render React → Use parent Tailwind CSS

New Flow:
Import CSS → Render React to plugin's document.getElementById('app') → logseq.showMainUI() → Use bundled Tailwind CSS
```

**How It Works:**

1. **Plugin Iframe Context**: Logseq loads each plugin in its own iframe. When you write `document` in plugin code, you're accessing the plugin's iframe document, not the parent window.

2. **showMainUI vs provideUI**:
   - `logseq.provideUI()`: Injects HTML into parent window's DOM (couples to parent styles)
   - `logseq.showMainUI()`: Shows the plugin's iframe (isolated styles)

3. **Theme Integration**: Use `logseq.UI.resolveThemeCssPropsVals()` to fetch Logseq theme variables and apply them to the plugin's `document.body.style`.

4. **Positioning**: Calculate position based on cursor/screen position and apply to container element.

### Alternative Approach: Auto-Injection (Not Recommended)

The auto-injection approach would extract used Tailwind classes and inject minimal CSS via `logseq.provideStyle()` while continuing to use `logseq.provideUI()`.

**Why Not Recommended:**
1. **Still Coupled**: Still injecting into parent window DOM
2. **Build Complexity**: Requires AST parsing or regex extraction of class names
3. **Maintenance Burden**: Must track class usage across codebase
4. **Fragile**: Dynamic class generation can break extraction
5. **Potential Conflicts**: Logseq's Tailwind could still interfere with specificity
6. **Not Future-Proof**: Doesn't solve the fundamental coupling issue

## Components and Interfaces

### 1. HTML Entry Point

**New File: `index.html`**

Create an HTML entry point for the plugin (similar to logseq-assets-plus-main):

```html
<!doctype html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Logseq Anki Sync</title>
</head>
<body>
<div id="app"></div>
<script src="./src/index.ts" type="module"></script>
</body>
</html>
```

### 2. CSS Entry Point

**New File: `src/ui/styles/main.css`**

Create a CSS file that imports Tailwind and custom styles:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Theme variable defaults (will be overridden dynamically) */
:root, html {
  --ls-primary-background-color: #ffffff;
  --ls-secondary-background-color: #f7f7f7;
  --ls-tertiary-background-color: #eaeaea;
  --ls-quaternary-background-color: #dcdcdc;
  --ls-active-primary-color: rgb(0, 105, 182);
  --ls-border-color: #ccc;
  --ls-primary-text-color: #433f38;
  /* ... all other theme variables with defaults */
}

html[data-theme='dark'] {
  --ls-primary-background-color: #002b36;
  --ls-secondary-background-color: #023643;
  /* ... dark mode defaults */
}

body {
  padding: 0;
  margin: 0;
  box-sizing: border-box;
  font-family: sans-serif;
  color: var(--ls-primary-text-color);
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  position: relative;
}

/* Existing custom CSS from UI.init() */
.reduce-opacity-when-disabled:disabled {
  opacity: 0.5;
}

.not-allowed-cursor-when-disabled:disabled {
  cursor: not-allowed;
}

.anki_ui_link_button {
  background-color: transparent;
  opacity: 0.8;
}

/* ... rest of custom CSS ... */
```

### 3. UI Mounting System Refactor

**Current Implementation:**
```typescript
// src/ui/UI.ts
class UI {
  static async mountReactComponentInLogseq(key, path, component) {
    logseq.provideUI({ key, path, template: `<div id="${key}"></div>` });
    await waitForElement(`//div[@id='${key}']`, 10000, WindowParentBridge.getDocument());
    ReactDOM.render(component, WindowParentBridge.getElementById(key));
  }
}
```

**New Implementation:**
```typescript
// src/ui/UI.ts
import '../styles/main.css'; // Import bundled Tailwind + custom CSS

class UI {
  private static appRoot: HTMLElement | null = null;
  private static isVisible: boolean = false;

  static init() {
    // Initialize theme variables
    this.loadThemeVariables();
    
    // Listen for theme changes
    logseq.App.onThemeChanged(() => {
      setTimeout(() => this.loadThemeVariables(), 100);
    });
    
    logseq.App.onThemeModeChanged((mode) => {
      setTimeout(() => this.loadThemeVariables(), 100);
      this.setThemeMode(mode.mode);
    });
    
    // Listen for visibility changes
    logseq.on('ui:visible:changed', ({ visible }) => {
      this.isVisible = visible;
      if (visible) {
        this.loadThemeVariables();
      }
    });
    
    // Get initial theme mode
    setTimeout(() => {
      logseq.App.getUserConfigs().then(config => {
        this.setThemeMode(config.preferredThemeMode);
      });
    }, 100);
  }

  private static async loadThemeVariables() {
    const props = [
      '--ls-primary-background-color',
      '--ls-secondary-background-color',
      '--ls-tertiary-background-color',
      '--ls-quaternary-background-color',
      '--ls-active-primary-color',
      '--ls-active-secondary-color',
      '--ls-border-color',
      '--ls-secondary-border-color',
      '--ls-tertiary-border-color',
      '--ls-primary-text-color',
      '--ls-secondary-text-color',
      '--ls-block-highlight-color'
      // ... all other theme variables
    ];

    try {
      // @ts-ignore - logseq.UI.resolveThemeCssPropsVals is not in types
      const vals = await logseq.UI.resolveThemeCssPropsVals(props);
      if (!vals) return;
      
      const style = document.body.style;
      Object.entries(vals).forEach(([k, v]) => {
        style.setProperty(k, v as string);
      });
    } catch (error) {
      logger.warn('Failed to load theme variables:', error);
    }
  }

  private static setThemeMode(mode: string) {
    document.documentElement.dataset.theme = mode;
  }

  static async showModal(component: React.ReactElement, position?: { left: number; top: number }) {
    // Get app root
    this.appRoot = document.getElementById('app');
    if (!this.appRoot) {
      logger.error('App root not found');
      return;
    }

    // Apply positioning if provided
    if (position) {
      this.appRoot.style.position = 'absolute';
      this.appRoot.style.left = `${position.left}px`;
      this.appRoot.style.top = `${position.top}px`;
      this.appRoot.style.transform = 'unset';
    } else {
      // Center on screen
      this.appRoot.style.position = 'fixed';
      this.appRoot.style.left = '50%';
      this.appRoot.style.top = '15%';
      this.appRoot.style.transform = 'translate3d(-50%, 0, 0)';
    }

    // Render component
    ReactDOM.render(component, this.appRoot);

    // Show the UI
    logseq.showMainUI();
  }

  static hideModal() {
    logseq.hideMainUI({ restoreEditingCursor: true });
    
    // Unmount React component
    if (this.appRoot) {
      ReactDOM.unmountComponentAtNode(this.appRoot);
    }
  }

  // Helper to get cursor position for positioning modals
  static async getCursorPosition(): Promise<{ left: number; top: number; rect: any } | null> {
    try {
      const pos = await logseq.Editor.getEditingCursorPosition();
      return pos || null;
    } catch (error) {
      logger.warn('Failed to get cursor position:', error);
      return null;
    }
  }
}
```

### 4. Modal System Adaptation

**Challenge**: Modals need to handle visibility and positioning correctly.

**Solution**: Update modal components to use new UI system:

```typescript
// src/ui/modals/Modal.tsx
export function Modal({ open, setOpen, children, onClose, ...props }: ModalProps) {
  // Handle close
  const handleClose = React.useCallback(() => {
    setOpen(false);
    if (onClose) onClose();
    UI.hideModal();
  }, [setOpen, onClose]);

  // Handle keyboard events
  const onKeydown = React.useCallback((e: KeyboardEvent) => {
    if (!open) return;
    
    if (e.key === "Escape") {
      handleClose();
      return;
    }
    
    // Handle arrow keys for scrolling
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      const modalRoot = (e.target as Element).closest('.ui__modal');
      const divWithScrollbar = modalRoot?.querySelector('div[style*="overflow"]');
      // ... rest of scrolling logic
    }
  }, [open, handleClose]);

  React.useEffect(() => {
    if (open) {
      document.addEventListener("keydown", onKeydown);
      return () => document.removeEventListener("keydown", onKeydown);
    }
  }, [open, onKeydown]);

  // Handle click outside to close
  React.useEffect(() => {
    if (!open) return;
    
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const modalContent = document.querySelector('.ui__modal-panel');
      if (modalContent && !modalContent.contains(target)) {
        handleClose();
      }
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [open, handleClose]);

  if (!open) return null;

  return (
    <FocusTrap focusTrapOptions={{ ...focusTrapOptions }}>
      <div className="ui__modal" style={{zIndex: props.zDepth === "high" ? 9999 : 999}}>
        <div className="ui__modal-overlay ease-out duration-300 opacity-100 enter-done">
          <div className="absolute inset-0 opacity-75"></div>
        </div>
        <div className="ui__modal-panel transform transition-all sm:min-w-lg sm ease-out duration-300 opacity-100 translate-y-0 sm:scale-100 enter-done">
          {/* ... modal content ... */}
        </div>
      </div>
    </FocusTrap>
  );
}
```

### 5. Component Usage Pattern

**Example: Showing a Modal**

```typescript
// Before (using provideUI)
await UI.mountReactComponentInLogseq(
  'sync-result-dialog',
  '#root main',
  <SyncResultDialog {...props} />
);

// After (using showMainUI)
await UI.showModal(<SyncResultDialog {...props} />);
```

**Example: Showing a Modal at Cursor Position**

```typescript
const cursorPos = await UI.getCursorPosition();
await UI.showModal(
  <SelectionModal {...props} />,
  cursorPos ? { left: cursorPos.left + cursorPos.rect.left, top: cursorPos.top + cursorPos.rect.top } : undefined
);
```

### 6. WindowParentBridge Updates

**Current**: WindowParentBridge provides access to parent window objects.

**Updates Needed**: Clarify that most operations now happen in plugin's own document:

```typescript
// src/logseq/WindowParentBridge.ts
export class WindowParentBridge {
  // Keep existing methods for parent window access (for fabric.js, etc.)
  static getParentWindow(): Window {
    return window.parent;
  }

  static getParentDocument(): Document {
    return window.parent.document;
  }

  // Add helper to distinguish plugin vs parent context
  static isPluginContext(): boolean {
    return window !== window.parent;
  }

  // Most UI operations now use plugin's own document
  static getPluginDocument(): Document {
    return document; // Plugin's own document
  }

  static getElementById(id: string): HTMLElement | null {
    return document.getElementById(id); // Plugin's own document
  }

  // Keep parent window methods for specific needs (fabric.js, etc.)
  static getParentElementById(id: string): HTMLElement | null {
    return window.parent.document.getElementById(id);
  }

  // ... rest of existing methods
}
```

### 7. OcclusionEditor Special Handling

**Challenge**: OcclusionEditor uses fabric.js which is loaded into parent window.

**Solution**: fabric.js can still operate on canvas elements in the plugin's document. JavaScript has no restrictions accessing elements across iframe boundaries (only CSS is isolated):

```typescript
// src/ui/pages/OcclusionEditor.tsx
React.useEffect(() => {
  const initFabric = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Get fabric.js from parent window
    const Fabric = WindowParentBridge.getFabric();
    
    // Create fabric canvas on plugin's canvas element
    fabricRef.current = new Fabric.Canvas(canvas, {
      stateful: true,
    });
    
    // Works normally - JavaScript can access elements across iframes
  };
  
  initFabric();
}, []);
```

**Note**: No changes needed to fabric.js interaction logic. Only CSS is isolated between iframes, not JavaScript access.

## Data Models

### Tailwind Configuration

**New File: `tailwind.config.js`**

```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Use CSS variables for theme colors
        'primary': 'var(--ls-active-primary-color)',
        'background': 'var(--ls-primary-background-color)',
        'secondary-background': 'var(--ls-secondary-background-color)',
        'border': 'var(--ls-border-color)',
        'text': 'var(--ls-primary-text-color)',
        // ... other color mappings
      },
    },
  },
  plugins: [],
}
```

### Vite Configuration Updates

**Update: `vite.config.ts`**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import logseqDevPlugin from 'vite-plugin-logseq';

export default defineConfig({
  plugins: [
    react(),
    logseqDevPlugin(),
  ],
  build: {
    target: 'esnext',
    minify: 'esbuild',
    rollupOptions: {
      input: {
        main: 'index.html', // Entry point for the plugin
      },
    },
  },
  css: {
    postcss: {
      plugins: [
        require('tailwindcss'),
        require('autoprefixer'),
      ],
    },
  },
});
```

### Package.json Updates

**Update: `package.json`**

Add Tailwind CSS dependencies:

```json
{
  "devDependencies": {
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0",
    // ... existing devDependencies
  }
}
```

## Correctness Properties

A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.

Based on the prework analysis, most requirements are analysis and documentation tasks that are not testable as properties. However, we identified several critical runtime behaviors that must be validated through property-based testing:

### Property 1: Theme Variable Inheritance and Dynamic Updates

*For any* Logseq theme variable (e.g., `--ls-primary-background-color`, `--ls-border-color`), when the variable is fetched using `logseq.UI.resolveThemeCssPropsVals()` and applied to `document.body.style`, the variable should be accessible to all UI components, and when the variable value changes in Logseq (theme switch), the plugin UI should reflect the updated value after calling `loadThemeVariables()` again.

**Validates: Requirements 4.1, 4.4, 4.5**

**Rationale**: This property ensures that the plugin maintains theme compatibility with Logseq. The `logseq.UI.resolveThemeCssPropsVals()` API fetches current theme variable values from the parent window, and applying them to the plugin's `document.body.style` makes them available to all CSS in the plugin's iframe. This property validates that theme variables are correctly fetched and applied, and that theme changes trigger re-fetching.

### Property 2: Modal Behavior Preservation

*For any* modal component (Modal, ConfirmModal, ButtonModal, SelectionModal), when rendered using `UI.showModal()`, the modal should open and be visible, close when the close button is clicked or Escape is pressed (calling `UI.hideModal()`), trap focus within the modal while open, and allow scrolling with arrow keys.

**Validates: Requirements 6.2**

**Rationale**: Modals are the primary UI interaction pattern in the plugin. This property ensures that switching from `provideUI` to `showMainUI` doesn't break core modal functionality including open/close behavior, keyboard navigation, and focus management.

### Property 3: Keyboard Shortcut and Focus Management

*For any* UI component with keyboard shortcuts (Enter to confirm, Escape to cancel, Ctrl+A to select all, arrow keys for navigation), when rendered in the plugin's iframe, the keyboard shortcuts should trigger the correct actions, and focus should move correctly between interactive elements using Tab/Shift+Tab.

**Validates: Requirements 6.3**

**Rationale**: Keyboard shortcuts are critical for user productivity. This property ensures that event listeners attached to the plugin's `document` correctly capture and handle keyboard events, and that focus management works within the plugin's iframe.

### Property 4: Accessibility Feature Preservation

*For any* UI component with accessibility features (ARIA labels, roles, focus trap, screen reader text), when rendered in the plugin's iframe, all ARIA attributes should be present, focus trap should prevent focus from leaving modals, and interactive elements should be keyboard-accessible.

**Validates: Requirements 6.4**

**Rationale**: Accessibility is non-negotiable. This property ensures that rendering in the plugin's iframe doesn't break accessibility features. The focus-trap-react library should work normally, and all ARIA attributes should be preserved.

### Example Test: Dark Mode and Light Mode Switching

**Test Case**: When Logseq theme is switched from light mode to dark mode (or vice versa), and `loadThemeVariables()` is called, the plugin UI should update to reflect the new theme colors without requiring a page reload.

**Validates: Requirements 4.2**

**Rationale**: This is a specific, high-value test case that validates theme switching works correctly. It's an example rather than a property because it tests specific theme modes rather than all possible theme configurations.


## Error Handling

### Theme Variable Fetch Failures

**Scenario**: `logseq.UI.resolveThemeCssPropsVals()` fails or returns undefined.

**Handling**:
```typescript
private static async loadThemeVariables() {
  try {
    // @ts-ignore
    const vals = await logseq.UI.resolveThemeCssPropsVals(props);
    if (!vals) {
      logger.warn('Theme variables not available, using defaults');
      return;
    }
    
    const style = document.body.style;
    Object.entries(vals).forEach(([k, v]) => {
      style.setProperty(k, v as string);
    });
  } catch (error) {
    logger.error('Failed to load theme variables:', error);
    // Fallback to CSS defaults defined in main.css
  }
}
```

**Rationale**: CSS file includes default values for all theme variables, so UI remains functional even if theme variable fetching fails.

### showMainUI Failures

**Scenario**: `logseq.showMainUI()` fails or doesn't show the UI.

**Handling**:
```typescript
static async showModal(component: React.ReactElement, position?: { left: number; top: number }) {
  try {
    this.appRoot = document.getElementById('app');
    if (!this.appRoot) {
      throw new Error('App root element not found');
    }

    // Apply positioning
    if (position) {
      this.appRoot.style.position = 'absolute';
      this.appRoot.style.left = `${position.left}px`;
      this.appRoot.style.top = `${position.top}px`;
    }

    // Render component
    ReactDOM.render(component, this.appRoot);

    // Show the UI
    logseq.showMainUI();
    
    // Verify UI is visible
    setTimeout(() => {
      if (!this.isVisible) {
        logger.warn('UI may not be visible after showMainUI()');
      }
    }, 100);
  } catch (error) {
    logger.error('Failed to show modal:', error);
    logseq.UI.showMsg('Failed to show plugin UI. Please try again.', 'error');
    throw error;
  }
}
```

### Focus Trap Failures

**Scenario**: focus-trap-react fails to work in plugin iframe.

**Handling**:
```typescript
// Test focus trap during initialization
React.useEffect(() => {
  if (open) {
    try {
      // Verify focus trap is working
      const activeElement = document.activeElement;
      const modalPanel = document.querySelector('.ui__modal-panel');
      
      if (modalPanel && !modalPanel.contains(activeElement)) {
        logger.warn('Focus trap may not be working correctly');
        // Try to focus first focusable element
        const firstFocusable = modalPanel.querySelector('button, input, textarea, select');
        if (firstFocusable instanceof HTMLElement) {
          firstFocusable.focus();
        }
      }
    } catch (error) {
      logger.error('Focus trap error:', error);
    }
  }
}, [open]);
```

**Fallback**: If focus-trap-react doesn't work, implement manual focus management using `tabindex` and keyboard event handlers.

### Fabric.js Integration Issues

**Scenario**: fabric.js (loaded in parent window) cannot access canvas in plugin iframe.

**Handling**:
```typescript
// Verify fabric.js can access plugin iframe canvas
React.useEffect(() => {
  const initFabric = async () => {
    try {
      const canvas = canvasRef.current;
      if (!canvas) {
        throw new Error('Canvas element not found');
      }
      
      // Get fabric.js from parent window
      const Fabric = WindowParentBridge.getFabric();
      if (!Fabric) {
        throw new Error('Fabric.js not loaded in parent window');
      }
      
      fabricRef.current = new Fabric.Canvas(canvas, {
        stateful: true,
      });
      
      // Verify fabric instance was created
      if (!fabricRef.current) {
        throw new Error('Failed to create Fabric canvas');
      }
    } catch (error) {
      logger.error('Fabric.js initialization failed:', error);
      logseq.UI.showMsg('Failed to initialize occlusion editor', 'error');
      handleCancel(); // Close the editor
    }
  };
  
  initFabric();
}, []);
```

**Note**: JavaScript can access elements across iframe boundaries without restrictions. Only CSS is isolated. Fabric.js should work normally.

### CSS Loading Failures

**Scenario**: Bundled Tailwind CSS fails to load.

**Handling**:
```typescript
// In main.css import
import './styles/main.css';

// Verify styles loaded
setTimeout(() => {
  const testElement = document.createElement('div');
  testElement.className = 'flex'; // Test Tailwind class
  document.body.appendChild(testElement);
  
  const styles = window.getComputedStyle(testElement);
  if (styles.display !== 'flex') {
    logger.error('Tailwind CSS may not have loaded correctly');
    logseq.UI.showMsg('Plugin styles failed to load. UI may not display correctly.', 'warning');
  }
  
  document.body.removeChild(testElement);
}, 1000);
```

## Testing Strategy

### Dual Testing Approach

The testing strategy combines unit tests for specific scenarios and property-based tests for universal behaviors:

**Unit Tests**: Focus on specific examples, edge cases, and integration points
- Dark mode / light mode switching (example test)
- Specific modal open/close scenarios
- Specific keyboard shortcut combinations
- Edge cases like theme variable fetch failures
- Integration with fabric.js in OcclusionEditor
- Positioning logic for modals

**Property-Based Tests**: Verify universal properties across all inputs
- Theme variable fetching and application for any variable name
- Modal behavior for any modal component
- Keyboard shortcuts for any interactive component
- Accessibility features for any UI component

### Property-Based Testing Configuration

**Library**: Use `fast-check` for TypeScript property-based testing

**Configuration**:
```typescript
import fc from 'fast-check';

describe('Plugin Iframe Theme Variables', () => {
  it('Property 1: Theme variable fetching and dynamic updates', () => {
    fc.assert(
      fc.property(
        fc.record({
          variableName: fc.constantFrom(
            '--ls-primary-background-color',
            '--ls-secondary-background-color',
            '--ls-border-color',
            '--ls-primary-text-color',
            '--ls-secondary-text-color'
          ),
          initialValue: fc.hexaString({ minLength: 6, maxLength: 6 }).map(h => `#${h}`),
          updatedValue: fc.hexaString({ minLength: 6, maxLength: 6 }).map(h => `#${h}`)
        }),
        async ({ variableName, initialValue, updatedValue }) => {
          // Mock logseq.UI.resolveThemeCssPropsVals to return initial value
          const mockResolve = jest.fn().mockResolvedValueOnce({
            [variableName]: initialValue
          });
          // @ts-ignore
          logseq.UI.resolveThemeCssPropsVals = mockResolve;
          
          // Load theme variables
          await UI.loadThemeVariables();
          
          // Verify initial value is applied to document.body.style
          const initialApplied = document.body.style.getPropertyValue(variableName);
          expect(initialApplied).toBe(initialValue);
          
          // Mock updated value
          mockResolve.mockResolvedValueOnce({
            [variableName]: updatedValue
          });
          
          // Load theme variables again (simulating theme change)
          await UI.loadThemeVariables();
          
          // Verify updated value is applied
          const updatedApplied = document.body.style.getPropertyValue(variableName);
          expect(updatedApplied).toBe(updatedValue);
          
          // Cleanup
          document.body.style.removeProperty(variableName);
          
          return initialApplied !== updatedApplied;
        }
      ),
      { numRuns: 100 } // Run 100 iterations
    );
  });
});
```

**Test Tags**: Each property test must reference its design document property:
```typescript
/**
 * Feature: ui-tailwind-decoupling
 * Property 1: Theme variable fetching and dynamic updates
 * 
 * For any Logseq theme variable, when fetched using logseq.UI.resolveThemeCssPropsVals()
 * and applied to document.body.style, the variable should be accessible to all UI components,
 * and when the value changes and loadThemeVariables() is called again, the UI should reflect
 * the updated value.
 */
```

### Unit Test Examples

```typescript
describe('Plugin Iframe UI Components', () => {
  it('should switch from light mode to dark mode', async () => {
    // Mock theme variable fetch for light mode
    const mockResolve = jest.fn().mockResolvedValueOnce({
      '--ls-primary-background-color': '#ffffff',
      '--ls-primary-text-color': '#333333'
    });
    // @ts-ignore
    logseq.UI.resolveThemeCssPropsVals = mockResolve;
    
    // Load light mode theme
    await UI.loadThemeVariables();
    document.documentElement.dataset.theme = 'light';
    
    // Render test component
    await UI.showModal(<TestComponent />);
    
    // Verify light mode colors
    const testElement = document.querySelector('.test-element');
    expect(window.getComputedStyle(testElement).backgroundColor).toBe('rgb(255, 255, 255)');
    
    // Mock theme variable fetch for dark mode
    mockResolve.mockResolvedValueOnce({
      '--ls-primary-background-color': '#1a1a1a',
      '--ls-primary-text-color': '#ffffff'
    });
    
    // Switch to dark mode
    await UI.loadThemeVariables();
    document.documentElement.dataset.theme = 'dark';
    
    // Wait for style update
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Verify dark mode colors
    expect(window.getComputedStyle(testElement).backgroundColor).toBe('rgb(26, 26, 26)');
  });

  it('should handle modal keyboard shortcuts', async () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    
    await UI.showModal(<Modal open={true} onConfirm={onConfirm} onCancel={onCancel} />);
    
    // Press Enter
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(onConfirm).toHaveBeenCalled();
    
    // Press Escape
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalled();
    expect(logseq.hideMainUI).toHaveBeenCalled();
  });

  it('should position modal at cursor position', async () => {
    const mockCursorPos = {
      left: 100,
      top: 200,
      rect: { left: 50, top: 100 }
    };
    
    jest.spyOn(logseq.Editor, 'getEditingCursorPosition').mockResolvedValue(mockCursorPos);
    
    const cursorPos = await UI.getCursorPosition();
    await UI.showModal(<TestModal />, cursorPos ? {
      left: cursorPos.left + cursorPos.rect.left,
      top: cursorPos.top + cursorPos.rect.top
    } : undefined);
    
    const appRoot = document.getElementById('app');
    expect(appRoot.style.left).toBe('150px'); // 100 + 50
    expect(appRoot.style.top).toBe('300px'); // 200 + 100
  });
});
```

### Integration Testing

**Test Environment**: Vitest with jsdom environment (existing setup)

**Key Integration Tests**:
1. OcclusionEditor with fabric.js from parent window
2. Modal focus trap with focus-trap-react in plugin iframe
3. Notification system rendering in plugin iframe
4. Progress indicators updating in plugin iframe
5. Theme switching while modals are open
6. Modal positioning at cursor vs centered

### Manual Testing Checklist

After implementation, manually verify:
- [ ] All modals open and close correctly using showMainUI/hideMainUI
- [ ] Keyboard shortcuts work (Enter, Escape, Ctrl+A, arrows)
- [ ] Focus trap works in modals
- [ ] Theme switching updates UI immediately
- [ ] Custom themes work correctly
- [ ] OcclusionEditor canvas interactions work with parent window fabric.js
- [ ] Notifications display correctly
- [ ] Progress indicators update correctly
- [ ] UI matches Logseq's visual style
- [ ] No console errors related to iframe rendering
- [ ] Accessibility features work (screen readers, keyboard navigation)
- [ ] Modal positioning works correctly (cursor position and centered)
- [ ] Plugin UI is immune to Logseq Tailwind CSS changes

## Implementation Phases

### Phase 1: Build System Setup (Low Risk)

**Goal**: Set up Tailwind CSS bundling and HTML entry point.

**Tasks**:
1. Install Tailwind CSS, PostCSS, and Autoprefixer as dependencies
2. Create `tailwind.config.js` with content paths and theme configuration
3. Create `src/ui/styles/main.css` that imports Tailwind and custom CSS
4. Create `index.html` entry point with `<div id="app"></div>`
5. Update `vite.config.ts` to use `index.html` as entry point
6. Update `package.json` main field to point to built `index.html`
7. Verify build succeeds and CSS is bundled correctly

**Validation**: Build succeeds, `dist/index.html` exists, CSS is bundled in output.

**Rollback**: Revert build config changes if issues arise.

### Phase 2: Theme System Implementation (Medium Risk)

**Goal**: Implement theme variable fetching without changing UI rendering.

**Tasks**:
1. Add `loadThemeVariables()` method to UI class
2. Add `setThemeMode()` method to UI class
3. Set up theme change listeners (onThemeChanged, onThemeModeChanged)
4. Set up visibility change listener to reload theme variables
5. Test theme variable fetching with console.log
6. Verify theme variables are applied to `document.body.style`
7. Test theme switching manually

**Validation**: Theme variables are fetched and applied correctly, theme switching works.

**Rollback**: Remove theme fetching code if issues arise.

### Phase 3: UI Mounting System Refactor (High Risk)

**Goal**: Switch from `provideUI` to `showMainUI` for all UI components.

**Tasks**:
1. Create `UI.showModal()` method that uses `logseq.showMainUI()`
2. Create `UI.hideModal()` method that uses `logseq.hideMainUI()`
3. Create `UI.getCursorPosition()` helper method
4. Update all modal components to call `UI.hideModal()` on close
5. Update all places that call `mountReactComponentInLogseq()` to use `showModal()`
6. Remove old `mountReactComponentInLogseq()` method
7. Remove old `getEventHandlersForMountedReactComponent()` method
8. Test each modal individually

**Validation**: All modals open and close correctly using showMainUI/hideMainUI.

**Rollback**: Revert to old mounting system if critical issues found.

### Phase 4: Component Updates (Medium Risk)

**Goal**: Update components to work correctly in plugin iframe context.

**Tasks**:
1. Update Modal component to handle close via `UI.hideModal()`
2. Update all modal variants (ConfirmModal, ButtonModal, SelectionModal, DialogModal)
3. Update event listeners to use plugin's `document` instead of parent window
4. Update WindowParentBridge documentation to clarify plugin vs parent context
5. Test keyboard shortcuts in all modals
6. Test focus management in all modals
7. Test OcclusionEditor with fabric.js

**Validation**: All components work correctly in plugin iframe, no regressions.

**Rollback**: Revert component changes if issues found.

### Phase 5: Testing and Refinement (Low Risk)

**Goal**: Comprehensive testing and bug fixes.

**Tasks**:
1. Write property-based tests for theme variables
2. Write property-based tests for modal behavior
3. Write property-based tests for keyboard shortcuts
4. Write property-based tests for accessibility
5. Write unit tests for specific scenarios
6. Run all tests and fix any failures
7. Manual testing checklist
8. Performance testing
9. Accessibility testing

**Validation**: All tests pass, no regressions, performance acceptable.

### Phase 6: Cleanup (Low Risk)

**Goal**: Remove old code and finalize implementation.

**Tasks**:
1. Remove any remaining `provideUI()` calls (except toolbar button)
2. Remove unused imports and code
3. Update documentation
4. Add migration notes to changelog
5. Update README if needed

**Validation**: Code is clean, no dead code, documentation updated.

## Alternative Approaches Considered

### Hybrid Approach: showMainUI + provideUI

**Description**: Use `showMainUI` for most components but keep some components (like notifications) in parent DOM with `provideUI`.

**Pros**:
- Notifications could integrate better with Logseq's notification system
- Gradual migration possible

**Cons**:
- Complexity of maintaining two systems
- Still have coupling to Logseq CSS for some components
- Inconsistent architecture
- Confusing for developers

**Decision**: Not recommended. Full `showMainUI` provides cleaner architecture.

### CSS Modules Approach

**Description**: Use CSS Modules instead of Tailwind to generate scoped class names, continue using `provideUI`.

**Pros**:
- No Tailwind dependency
- Smaller CSS bundle
- Scoped styles

**Cons**:
- Requires rewriting all component styles
- Loses Tailwind's utility-first benefits
- Still vulnerable to Logseq CSS conflicts (specificity wars)
- Much larger refactoring effort
- Still coupled to parent window DOM

**Decision**: Not recommended. `showMainUI` with Tailwind is less work and more robust.

### Web Components Approach

**Description**: Convert all UI components to native Web Components with Shadow DOM.

**Pros**:
- True encapsulation
- Framework-agnostic
- Future-proof

**Cons**:
- Requires rewriting all React components
- Loses React ecosystem benefits (focus-trap-react, etc.)
- Much larger refactoring effort
- Learning curve for team
- Still need to solve theme variable access

**Decision**: Not recommended. Too much work for the benefit gained.

### Auto-Injection with provideStyle

**Description**: Extract all used Tailwind classes and inject minimal CSS via `logseq.provideStyle()`, continue using `provideUI`.

**Pros**:
- Minimal code changes
- Keep existing UI mounting system

**Cons**:
- Build complexity (AST parsing or regex extraction)
- Maintenance burden (track class usage)
- Fragile (dynamic classes break extraction)
- Still coupled to parent window DOM
- Potential specificity conflicts with Logseq's Tailwind
- Not future-proof

**Decision**: Not recommended. Doesn't solve the fundamental coupling issue.

## Risk Assessment

### High Risk Areas

1. **Modal Positioning**: Calculating correct position for modals at cursor vs centered
   - **Mitigation**: Test positioning logic early, provide fallback to centered positioning

2. **Theme Variable Fetching**: `logseq.UI.resolveThemeCssPropsVals()` may not be documented or stable
   - **Mitigation**: Provide fallback defaults in CSS, test with multiple Logseq versions

3. **Event Handling**: Event listeners may behave differently in plugin iframe vs parent window
   - **Mitigation**: Test all keyboard shortcuts and click handlers thoroughly

### Medium Risk Areas

1. **Focus Management**: focus-trap-react may behave differently in plugin iframe
   - **Mitigation**: Test early, implement manual focus management as fallback

2. **Fabric.js Integration**: Canvas in plugin iframe accessed by parent window fabric.js
   - **Mitigation**: Test OcclusionEditor early in Phase 4

3. **Z-Index Stacking**: Modals may have z-index issues with Logseq UI
   - **Mitigation**: Use high z-index values, test with various Logseq UI states

### Low Risk Areas

1. **Build System**: Tailwind bundling via Vite is straightforward
2. **Component Rendering**: React works normally in plugin iframe
3. **Styling**: Tailwind classes work the same in plugin iframe
4. **CSS Isolation**: Plugin iframe CSS is automatically isolated from parent

## Success Criteria

The implementation is successful when:

1. ✅ All UI components render correctly using `showMainUI`
2. ✅ All property-based tests pass (100+ iterations each)
3. ✅ All unit tests pass
4. ✅ Manual testing checklist completed
5. ✅ No regressions in existing functionality
6. ✅ Theme switching works correctly (fetches and applies new variables)
7. ✅ Keyboard shortcuts work correctly in plugin iframe
8. ✅ Focus management works correctly
9. ✅ Accessibility features preserved
10. ✅ Performance is acceptable (no significant degradation)
11. ✅ Plugin UI is immune to Logseq Tailwind CSS changes
12. ✅ Modal positioning works correctly (cursor and centered)
13. ✅ OcclusionEditor works with parent window fabric.js

## Conclusion

The `logseq.showMainUI()` approach with bundled Tailwind CSS is the recommended solution for decoupling the plugin UI from Logseq's Tailwind CSS. This approach provides:

- **Complete Style Isolation**: Plugin runs in its own iframe with its own CSS
- **Future-Proof Architecture**: No dependency on Logseq's styling decisions
- **Simple Implementation**: Just import CSS and use showMainUI/hideMainUI
- **Proven Pattern**: Used successfully by logseq-assets-plus-main and other plugins
- **Maintainability**: No need to track Tailwind class usage or extract CSS
- **Theme Compatibility**: Dynamic theme variable fetching via `logseq.UI.resolveThemeCssPropsVals()`

**Key Insight**: Logseq plugins already run in isolated iframes. The problem was that `logseq.provideUI()` injects elements into the parent window's DOM, creating CSS coupling. By switching to `logseq.showMainUI()`, we simply render in the plugin's own iframe instead of injecting into the parent.

The implementation is phased to minimize risk, with early validation points and rollback options. Property-based testing ensures correctness across all scenarios, while unit tests validate specific behaviors.

**Estimated Effort**: 3-5 days for full implementation and testing
**Risk Level**: Medium (mitigated by phased approach and comprehensive testing)
**Maintenance Impact**: Significantly reduced (no more Logseq CSS breakage)
