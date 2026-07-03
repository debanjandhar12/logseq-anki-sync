# MoveBlockCommand Fix Proposal

This document outlines the proposed solutions for the logic errors encountered in `MoveBlockCommand` test cases `(b)` and `(e)`.

## 1. Test (b): Moving a page under another page & Moving back to root
**Issue**: 
When `MoveBlockCommand` attempts to capture the state of the source block to allow for reversion, it calls `LogseqEditor.getPreviousBlock(srcBlockUuid, {parent: true})`. If `srcBlockUuid` is a page, this throws an error because a page does not have a resolvable `.parent` property. Also, reverting a block to the root of an empty page (or back to the start of a page) has edge cases.

**Proposed Solution**:
1. **Identify if the Source is a Page**: Before calling `getPreviousBlock`, we check if the source is a page using Logseq API properties. If it is a page, we skip capturing the `previousBlock` state (as pages have no parent).
2. **Handle Page Move Reversion**:
   - If the source was a page, it cannot be "un-moved" to a root page using `logseq.Editor.moveBlock` (since it's already a root page if it was never moved, and if it *was* moved under another page, Logseq technically treats it as a block). We must explicitly handle or throw if the Logseq API doesn't support un-nesting a page entity.
   - Alternatively, if we are restoring a block that was originally at the **root of a page** (i.e. it was the first block on the page, so it had no previous sibling and its parent was the page):
     - `logseq.Editor.moveBlock(srcBlockUuid, pageUuid, { children: true })` places it at the **end** of the page, not the beginning.
     - To restore it to its exact original position at the root, we must get the *current* first block of the page using `logseq.Editor.getPageBlocksTree(pageUuid)`.
     - If the page has blocks, we execute `logseq.Editor.moveBlock(srcBlockUuid, firstBlockUuid, { before: true })`.
     - If the page is empty, we execute `logseq.Editor.moveBlock(srcBlockUuid, pageUuid, { children: true })`.

3. **Enforce Test (c) Constraints**: Ensure that if the source is a page, we explicitly throw an error if `children: false` is passed.

## 2. Test (e): Moving a parent block under its own child block
**Issue**:
`logseq.Editor.moveBlock` does not inherently reject moving a block into its own descendant tree, leading to the test case failing to throw an error.

**Proposed Solution**:
Add a circular reference validation before executing the move in `MoveBlockCommand.ts`.
1. **Traverse the Parent Chain**: Traverse upwards from the destination block using its `.parent.id`. 
2. **Check for Match**: If at any point the traversed parent's `id` or `uuid` matches the `srcBlockUuid`, throw a descriptive error (e.g., `"Cannot move a parent block into its own descendant"`).

---
**Next Steps**:
If you approve this plan, I will implement these changes in `MoveBlockCommand.ts` and `LogseqEditor.ts`, ensuring the tests pass correctly.
