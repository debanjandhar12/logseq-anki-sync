# UI module organization

The highlight mask editor, image occlusion editor, sync selection dialog, and sync result
dialog live in separate directories under `src/ui/pages/`. Each directory exposes its public
components through an explicit `index.ts`, so launchers can keep importing the page by its
directory name.

Within a page module:

- The page-named component composes the modal, state, commands, and child components.
- Colocated `use*.ts` hooks own editor/canvas lifecycle, keyboard subscriptions, or selection
  state. Each subscription removes its own handlers when its dependencies change or it unmounts.
- Toolbar and section components render controls and receive actions from the page.
- Focused helpers handle text positions, occlusion serialization/geometry, and failed-note keys.
- Internal modules import concrete files rather than their own entry point or the root UI barrel.

Editor data types remain in the existing launcher modules. Quote matching and the JavaScript
occlusion helpers remain shared with note generation and Anki templates rather than belonging to
the editor UI.

`SyncSelectionDialog` retains its public link/row exports for compatibility. The result dialog
imports the row implementation directly without depending on the selection controller.

Keyboard hooks receive current actions and state, while respecting the active modal. In the
occlusion editor, the `object:modified` handler corrects bounds before recording a single undo
checkpoint; keyboard movement uses that same path.

Regression tests for these boundaries live under `tests/src/ui/pages/`.
