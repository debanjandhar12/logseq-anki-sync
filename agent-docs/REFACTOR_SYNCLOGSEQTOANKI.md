# Refactoring Proposal: syncLogseqToAnki.ts
## Hybrid Module + Minimal Services Approach

## Current State Analysis

### Structure Overview
- **File Size**: ~800 lines (~30KB)
- **Main Class**: `LogseqToAnkiSync` 
- **Key Methods**:
  - `sync()` - Entry point with guard logic
  - `performSync()` - Main orchestration (~300 lines)
  - `createNotes()` - Handles note creation logic
  - `updateNotes()` - Handles note update logic with hash comparison
  - `deleteNotes()` - Handles note deletion logic
  - `parseNote()` - Parses Logseq blocks into Anki fields (~200 lines)

### Current Responsibilities (Violation of SRP)
1. **Sync Orchestration** - Coordinating the overall sync flow
2. **Note Collection** - Gathering notes from various Note types (ClozeNote, SwiftArrowNote, etc.)
3. **Note Parsing** - Converting Logseq blocks to Anki fields (deck, breadcrumb, tags, extra)
4. **Hash Management** - Calculating and comparing dependency hashes
5. **Asset Management** - Handling media files and their storage
6. **UI Management** - Progress notifications and user prompts
7. **Error Handling** - Tracking and reporting failures
8. **Anki Model Management** - Creating/updating Anki card templates
9. **Batch Operations** - Managing create/update/delete operations

### Key Problems
1. **Tight Coupling**: Sync logic is intertwined with parsing, UI, and asset management
2. **Testing Difficulty**: Cannot test individual components in isolation
3. **Complexity**: The `parseNote()` method alone handles 6 different parsing concerns
4. **Maintainability**: Changes to one aspect (e.g., breadcrumb logic) require editing a monolithic method
5. **Reusability**: Logic cannot be reused or composed differently
6. **Readability**: Hard to understand the flow due to method size and mixed concerns

---

## Refactoring Approach

### Philosophy
Combine the best of modular and object-oriented approaches:

1. **Use module-based functions** for pure logic (parsing, calculation)
2. **Use minimal service classes** for stateful operations (sync execution)
3. **Keep orchestrator simple** in `LogseqToAnkiSync`

### Target Structure
```
src/sync/
├── syncLogseqToAnki.ts          # Main orchestrator (~150 lines)
├── operations/
│   ├── CreateNotesOperation.ts  # Handles note creation with error tracking
│   ├── UpdateNotesOperation.ts  # Handles note updates with hash comparison
│   └── DeleteNotesOperation.ts  # Handles note deletion
├── parsers/
│   ├── index.ts                 # Re-export all parsers
│   ├── NoteParser.ts            # Main parsing coordinator
│   ├── DeckParser.ts            # Deck resolution logic
│   ├── BreadcrumbAndParentBlockParser.ts      # Breadcrumb generation logic
│   ├── TagParser.ts             # Tag collection and normalization
│   ├── ExtraFieldParser.ts      # Extra field parsing
│   └── ParentContentParser.ts   # Parent content inclusion logic
├── cache/
│   ├── index.ts                 # Re-export cache utilities
│   ├── BlockAndPageHashCache.ts # Dependency graph and hash caching
│   └── NoteHashCalculator.ts    # Note hash calculation using cache
└── types.ts                     # Shared types
```

---

## Refactoring Phases

### Phase 1: Extract Parsers (Low Risk, High Value)

#### Goal
Extract the 6 parsing concerns from the monolithic `parseNote()` method into separate, testable modules.

#### Structure
```
src/sync/
├── syncLogseqToAnki.ts          # Keep as-is initially
└── parsers/
    ├── index.ts                 # Re-export all parsers
    ├── NoteParser.ts            # Orchestrates parsing
    ├── DeckParser.ts
    ├── BreadcrumbAndParentBlockParser.ts
    ├── TagParser.ts
    ├── ExtraFieldParser.ts
    └── ParentContentParser.ts
```

#### Example Implementation

```typescript
// parsers/NoteParser.ts
import { Note } from "../../anki-notes/Note";
import { ParsedNoteData } from "../types";
import { DeckParser } from "./DeckParser";
import { BreadcrumbAndParentBlockParser } from "./BreadcrumbAndParentBlockParser";
import { TagParser } from "./TagParser";
import { ExtraFieldParser } from "./ExtraFieldParser";
import { ParentContentParser } from "./ParentContentParser";

export async function parseNote(note: Note, graphName: string): Promise<ParsedNoteData> {
    // Parse HTML content with optional parent content
    let { html, assets, tags } = await note.getClozedContentHTML();
    const parentResult = await ParentContentParser.parse(note, html, assets, tags);
    html = parentResult.html;
    assets = parentResult.assets;
    tags = parentResult.tags;

    // Parse deck using hierarchy and settings
    const deck = await DeckParser.parse(note);

    // Parse breadcrumb trail
    const breadcrumb = await BreadcrumbAndParentBlockParser.parse(note, graphName);

    // Parse tags from hierarchy
    const collectedTags = await TagParser.parse(note, Array.from(tags));

    // Parse extra field
    const extra = await ExtraFieldParser.parse(note, assets);

    return [html, assets, deck, breadcrumb, collectedTags, extra];
}
```

```typescript
// parsers/DeckParser.ts
import { Note } from "../../anki-notes/Note";
import { LogseqProxy } from "../../logseq/LogseqProxy";
import { getLogseqBlockPropSafe, splitNamespace } from "../../utils/utils";
import _ from "lodash";

export class DeckParser {
    /**
     * Resolves the deck name for a note following the hierarchy:
     * 1. Block hierarchy (traverse up looking for deck property)
     * 2. Namespace hierarchy (traverse up looking for deck property)
     * 3. Namespace as deck (if useNamespaceAsDefaultDeck is true)
     * 4. Default deck from settings
     */
    static async parse(note: Note): Promise<string> {
        const useNamespaceAsDefault = await this.resolveUseNamespaceFlag(note);
        
        let deck = await this.findDeckInBlockHierarchy(note);
        if (deck !== null) return this.normalizeDeck(deck);

        deck = await this.findDeckInNamespaceHierarchy(note);
        if (deck !== null) return this.normalizeDeck(deck);

        if (useNamespaceAsDefault) {
            deck = this.extractNamespaceDeck(note);
            if (deck) return this.normalizeDeck(deck);
        }

        return this.normalizeDeck(this.getDefaultDeck());
    }

    private static async resolveUseNamespaceFlag(note: Note): Promise<boolean> {
        try {
            let parentNamespaceID: number = note.page.id;
            while (parentNamespaceID != null) {
                const parentNamespacePage = await LogseqProxy.Editor.getPage(parentNamespaceID);
                if (!parentNamespacePage) break;

                const propValue = getLogseqBlockPropSafe(
                    parentNamespacePage,
                    "properties.use-namespace-as-default-deck"
                );
                if ([true, "true"].includes(propValue)) return true;
                if ([false, "false"].includes(propValue)) return false;

                parentNamespaceID = _.get(parentNamespacePage, "namespace.id", null);
            }
        } catch (e) {
            console.error("[DeckParser] Error resolving useNamespaceFlag:", e);
        }

        const { useNamespaceAsDefaultDeck } = LogseqProxy.Settings.getPluginSettings();
        return useNamespaceAsDefaultDeck;
    }

    private static async findDeckInBlockHierarchy(note: Note): Promise<string | null> {
        try {
            let parentBlockUUID: string | number = note.uuid;
            while (parentBlockUUID != null) {
                const parentBlock = await LogseqProxy.Editor.getBlock(parentBlockUUID);
                const deck = getLogseqBlockPropSafe(parentBlock, "properties.deck");
                if (deck != null) return deck;
                parentBlockUUID = _.get(parentBlock, "parent.id", null);
            }
        } catch (e) {
            console.error("[DeckParser] Error finding deck in block hierarchy:", e);
        }
        return null;
    }

    private static async findDeckInNamespaceHierarchy(note: Note): Promise<string | null> {
        try {
            let parentNamespaceID: number = note.page.id;
            while (parentNamespaceID != null) {
                const parentNamespacePage = await LogseqProxy.Editor.getPage(parentNamespaceID);
                if (!parentNamespacePage) break;
                const deck = getLogseqBlockPropSafe(parentNamespacePage, "properties.deck");
                if (deck != null) return deck;
                parentNamespaceID = _.get(parentNamespacePage, "namespace.id", null);
            }
        } catch (e) {
            console.error("[DeckParser] Error finding deck in namespace hierarchy:", e);
        }
        return null;
    }

    private static extractNamespaceDeck(note: Note): string {
        const pageName = _.get(note, "page.originalName", "") || 
                        _.get(note, "page.properties.title", "");
        const namespaceSegments = splitNamespace(pageName);
        return namespaceSegments.slice(0, -1).join("/");
    }

    private static getDefaultDeck(): string {
        const { defaultDeck } = LogseqProxy.Settings.getPluginSettings();
        return defaultDeck || "Default";
    }

    private static normalizeDeck(deck: any): string {
        if (typeof deck !== "string") deck = deck[0];
        return splitNamespace(deck).join("::");
    }
}
```

```typescript
// parsers/BreadcrumbAndParentBlockParser.ts
import { Note } from "../../anki-notes/Note";
import { LogseqProxy } from "../../logseq/LogseqProxy";
import { ANKI_CLOZE_REGEXP, MD_PROPERTIES_REGEXP } from "../../constants";
import { BlockEntity } from "@logseq/libs/dist/LSPlugin";

export class BreadcrumbAndParentBlockParser {
    static async parse(note: Note, graphName: string): Promise<string> {
        const { breadcrumbDisplay } = LogseqProxy.Settings.getPluginSettings();
        
        if (!breadcrumbDisplay.includes("Show Page name")) {
            return this.buildHiddenBreadcrumb(note, graphName);
        }

        if (breadcrumbDisplay === "Show Page name and parent blocks context") {
            return await this.buildFullBreadcrumb(note, graphName);
        }

        return this.buildPageOnlyBreadcrumb(note, graphName);
    }

    private static buildHiddenBreadcrumb(note: Note, graphName: string): string {
        return `<a href="logseq://graph/${encodeURIComponent(graphName)}?page=${encodeURIComponent(
            note.page.originalName
        )}" class="hidden">${note.page.originalName}</a>`;
    }

    private static buildPageOnlyBreadcrumb(note: Note, graphName: string): string {
        return `<a href="logseq://graph/${encodeURIComponent(graphName)}?page=${encodeURIComponent(
            note.page.originalName
        )}" title="${note.page.originalName}">${note.page.originalName}</a>`;
    }

    private static async buildFullBreadcrumb(note: Note, graphName: string): Promise<string> {
        let breadcrumb = this.buildPageOnlyBreadcrumb(note, graphName);
        
        try {
            const parentBlocks = await this.collectParentBlocks(note);
            for (const parentBlock of parentBlocks) {
                const firstLine = parentBlock.content.split("\n")[0];
                breadcrumb += ` > <a href="logseq://graph/${encodeURIComponent(
                    graphName
                )}?block-id=${encodeURIComponent(parentBlock.uuid)}" title="${
                    parentBlock.content
                }">${firstLine}</a>`;
            }
        } catch (e) {
            console.error("[BreadcrumbAndParentBlockParser] Error building full breadcrumb:", e);
        }

        return breadcrumb;
    }

    private static async collectParentBlocks(note: Note): Promise<Array<{content: string, uuid: string}>> {
        const parentBlocks = [];
        let parentID = (await LogseqProxy.Editor.getBlock(note.uuid)).parent.id;
        let parentBlock: BlockEntity;

        while ((parentBlock = await LogseqProxy.Editor.getBlock(parentID)) != null) {
            parentBlocks.push({
                content: parentBlock.content
                    .replaceAll(MD_PROPERTIES_REGEXP, "")
                    .replaceAll(ANKI_CLOZE_REGEXP, "$3"),
                uuid: parentBlock.uuid,
            });
            parentID = parentBlock.parent.id;
        }

        return parentBlocks.reverse();
    }
}
```

```typescript
// parsers/TagParser.ts
import { Note } from "../../anki-notes/Note";
import { LogseqProxy } from "../../logseq/LogseqProxy";
import { getCaseInsensitive } from "../../utils/utils";
import _ from "lodash";

export class TagParser {
    static async parse(note: Note, initialTags: string[]): Promise<string[]> {
        let tags = [...initialTags];

        tags = await this.collectTagsFromBlockHierarchy(note, tags);
        tags = await this.collectTagsFromNamespaceHierarchy(note, tags);
        tags = this.normalizeTags(tags);
        tags = this.deduplicateTags(tags);
        tags = this.removeRedundantTags(tags);

        return tags;
    }

    private static async collectTagsFromBlockHierarchy(note: Note, tags: string[]): Promise<string[]> {
        try {
            let parentBlockUUID: string | number = note.uuid;
            while (parentBlockUUID != null) {
                const parentBlock = await LogseqProxy.Editor.getBlock(parentBlockUUID);
                const blockTags = getCaseInsensitive(parentBlock, "properties.tags", []);
                tags = [...tags, ...blockTags];
                parentBlockUUID = _.get(parentBlock, "parent.id", null);
            }
        } catch (e) {
            console.error("[TagParser] Error collecting tags from block hierarchy:", e);
        }
        return tags;
    }

    private static async collectTagsFromNamespaceHierarchy(note: Note, tags: string[]): Promise<string[]> {
        try {
            let parentNamespaceID: number = _.get(note, "page.id", null);
            while (parentNamespaceID != null) {
                const parentNamespacePage = await LogseqProxy.Editor.getPage(parentNamespaceID);
                const pageTags = getCaseInsensitive(parentNamespacePage, "properties.tags", []);
                tags = [...tags, ...pageTags];
                parentNamespaceID = _.get(parentNamespacePage, "namespace.id", null);
            }
        } catch (e) {
            console.error("[TagParser] Error collecting tags from namespace hierarchy:", e);
        }
        return tags;
    }

    private static normalizeTags(tags: string[]): string[] {
        return tags
            .map((tag) => tag.replace(/\//g, "::"))
            .map((tag) => tag.replace(/\s/g, "_"));
    }

    private static deduplicateTags(tags: string[]): string[] {
        return _.uniq(tags);
    }

    private static removeRedundantTags(tags: string[]): string[] {
        return tags.filter((tag) => {
            const otherTags = tags.filter((otherTag) => otherTag !== tag);
            const redundantTags = otherTags.filter((otherTag) =>
                otherTag.startsWith(tag + "::")
            );
            return redundantTags.length === 0;
        });
    }
}
```

```typescript
// parsers/ExtraFieldParser.ts
import { Note } from "../../anki-notes/Note";
import { LogseqProxy } from "../../logseq/LogseqProxy";
import { convertToHTMLFile } from "../../logseq/LogseqToHtmlConverter";
import _ from "lodash";

export class ExtraFieldParser {
    static async parse(note: Note, assets: Set<string>): Promise<string> {
        let extra = _.get(note, "properties.extra") || 
                    _.get(note, "page.properties.extra") || "";

        if (Array.isArray(extra)) {
            extra = extra.join(" ");
        }

        const format = (await LogseqProxy.Editor.getBlock(note.uuid)).format;
        const converted = await LogseqToHtmlConverter.convertToHTMLFile(extra, format);

        // Add extra assets to the main asset set
        converted.assets.forEach((asset) => assets.add(asset));

        return converted.html;
    }
}
```

```typescript
// parsers/ParentContentParser.ts
import { Note } from "../../anki-notes/Note";
import { LogseqProxy } from "../../logseq/LogseqProxy";
import { convertToHTMLFile } from "../../logseq/LogseqToHtmlConverter";
import { escapeClozesAndMacroDelimiters } from "../../utils/utils";
import { NoteUtils } from "../../anki-notes/NoteUtils";
import _ from "lodash";

interface ParentContentResult {
    html: string;
    assets: Set<string>;
    tags: Set<string>;
}

export class ParentContentParser {
    static async parse(
        note: Note,
        html: string,
        assets: Set<string>,
        tags: Set<string>
    ): Promise<ParentContentResult> {
        const { includeParentContent } = LogseqProxy.Settings.getPluginSettings();
        
        if (!includeParentContent) {
            return { html, assets, tags };
        }

        const parentBlocks = await this.collectParentBlocks(note, tags);
        const wrappedHtml = this.wrapWithParentContent(html, parentBlocks, note, assets);

        return { html: wrappedHtml, assets, tags };
    }

    private static async collectParentBlocks(note: Note, tags: Set<string>) {
        const parentBlocks = [];
        let parentID = (await LogseqProxy.Editor.getBlock(note.uuid)).parent.id;
        let parent;

        while ((parent = await LogseqProxy.Editor.getBlock(parentID)) != null) {
            const hiddenParent = (
                await NoteUtils.matchTagNamesWithTagIds(
                    _.get(parent, "refs", []).map((ref) => ref.id),
                    ["hide-when-card-parent"]
                )
            ).includes("hide-when-card-parent") || Array.from(tags).includes("hide-all-card-parent");

            parentBlocks.push({
                content: escapeClozesAndMacroDelimiters(parent.content),
                format: parent.format,
                uuid: parent.uuid,
                hiddenParent,
                properties: parent.properties,
            });
            parentID = parent.parent.id;
        }

        return parentBlocks.reverse();
    }

    private static wrapWithParentContent(
        html: string,
        parentBlocks: any[],
        note: Note,
        assets: Set<string>
    ): string {
        let newHtml = "";

        for (const parentBlock of parentBlocks) {
            const parentBlockConverted = convertToHTMLFile(parentBlock.content, parentBlock.format);
            
            if (parentBlock.hiddenParent) {
                newHtml += `<span class="hidden-parent">${parentBlockConverted.html}</span>`;
            } else {
                newHtml += parentBlockConverted.html;
            }

            parentBlockConverted.assets.forEach((asset) => assets.add(asset));

            const isNumbered = _.get(parentBlock, "properties['logseq.orderListType']") === "number";
            newHtml += `<ul class="children-list"><li class="children ${isNumbered ? 'numbered' : ''}">`;
        }

        const isNumbered = _.get(note, "properties['logseq.orderListType']") === "number";
        newHtml += `<ul class="children-list"><li class="children ${isNumbered ? 'numbered' : ''}">${html}</li></ul>`;

        for (let i = 0; i < parentBlocks.length; i++) {
            newHtml += `</li></ul>`;
        }

        return newHtml;
    }
}
```

```typescript
// parsers/index.ts
export { parseNote } from "./NoteParser";
export { DeckParser } from "./DeckParser";
export { BreadcrumbAndParentBlockParser } from "./BreadcrumbAndParentBlockParser";
export { TagParser } from "./TagParser";
export { ExtraFieldParser } from "./ExtraFieldParser";
export { ParentContentParser } from "./ParentContentParser";
```

#### Changes to syncLogseqToAnki.ts
```typescript
// In syncLogseqToAnki.ts, replace parseNote() method with:
import { parseNote } from "./parsers";

private async parseNote(note: Note): Promise<ParsedNoteData> {
    return await parseNote(note, this.graphName);
}
```

#### Benefits
- ✅ Each parser has single responsibility
- ✅ Easy to test in isolation
- ✅ Can reuse parsers in other contexts
- ✅ Reduces `parseNote()` from ~200 lines to ~30 lines
- ✅ No behavioral changes

---

### Phase 2: Extract Operations (Medium Risk, High Value)

#### Goal
Move create/update/delete logic into operation classes that encapsulate error tracking and batch execution.

#### Structure
```
src/sync/
├── syncLogseqToAnki.ts          # Simplified by delegating to operations
├── operations/
│   ├── CreateNotesOperation.ts
│   ├── UpdateNotesOperation.ts
│   └── DeleteNotesOperation.ts
└── parsers/
    └── ...
```

#### Example Implementation

```typescript
// operations/CreateNotesOperation.ts
import { Note } from "../../anki-notes/Note";
import { LazyAnkiNoteManager } from "../../anki-connect/LazyAnkiNoteManager";
import { ProgressNotification } from "../../ui";
import { ParsedNoteData } from "../types";
import NoteHashCalculator from "../NoteHashCalculator";
import path from "path-browserify";
import _ from "lodash";

export class CreateNotesOperation {
    async execute(
        notes: Note[],
        modelName: string,
        graphPath: string,
        ankiNoteManager: LazyAnkiNoteManager,
        parseNote: (note: Note) => Promise<ParsedNoteData>,
        progressNotification: ProgressNotification
    ): Promise<{ succeeded: Note[], failed: { [key: string]: Error } }> {
        const failedCreated: { [key: string]: Error } = {};

        for (const note of notes) {
            try {
                await this.createNote(note, modelName, graphPath, ankiNoteManager, parseNote);
            } catch (e) {
                console.error(e);
                failedCreated[`${note.uuid}-${note.type}`] = e;
            }
            progressNotification.increment();
        }

        const addResult = await ankiNoteManager.executeAddNotes();
        
        // Update ankiId of successfully added notes
        for (const successfulNote of addResult.successfulNotes) {
            const uuidtype = successfulNote["uuid-type"];
            const uuid = uuidtype.split("-").slice(0, -1).join("-");
            const type = uuidtype.split("-").slice(-1)[0];
            const note = _.find(notes, { uuid: uuid, type: type });
            if (note) {
                note["ankiId"] = successfulNote["ankiId"];
            }
        }

        // Track failures
        for (const failure of addResult.failedNotes) {
            console.error(failure.error);
            failedCreated[failure.identifier] = failure.error;
        }

        // Retry failed notes once
        const secondAddResult = await ankiNoteManager.executeAddNotes();
        for (const failure of secondAddResult.failedNotes) {
            console.error(failure.error);
        }

        const succeeded = notes.filter(n => !failedCreated[`${n.uuid}-${n.type}`]);
        return { succeeded, failed: failedCreated };
    }

    private async createNote(
        note: Note,
        modelName: string,
        graphPath: string,
        ankiNoteManager: LazyAnkiNoteManager,
        parseNote: (note: Note) => Promise<ParsedNoteData>
    ): Promise<void> {
        const [html, assets, deck, breadcrumb, tags, extra] = await parseNote(note);
        const dependencyHash = await NoteHashCalculator.getHash(note, [
            html,
            assets,
            deck,
            breadcrumb,
            tags,
            extra,
        ]);

        // Store assets
        assets.forEach((asset) => {
            ankiNoteManager.storeAsset(
                path.basename(asset),
                path.join(graphPath, path.resolve(asset))
            );
        });

        // Add note to queue
        ankiNoteManager.addNote(
            deck,
            modelName,
            {
                "uuid-type": `${note.uuid}-${note.type}`,
                uuid: note.uuid,
                Text: html,
                Extra: extra,
                Breadcrumb: breadcrumb,
                Config: JSON.stringify({
                    dependencyHash,
                    assets: [...assets],
                }),
            },
            tags
        );
    }
}
```

```typescript
// operations/UpdateNotesOperation.ts
import { Note } from "../../anki-notes/Note";
import { LazyAnkiNoteManager } from "../../anki-connect/LazyAnkiNoteManager";
import { ProgressNotification } from "../../ui";
import { ParsedNoteData } from "../types";
import NoteHashCalculator from "../NoteHashCalculator";
import { LogseqProxy } from "../../logseq/LogseqProxy";
import path from "path-browserify";

export class UpdateNotesOperation {
    async execute(
        notes: Note[],
        modelName: string,
        graphPath: string,
        ankiNoteManager: LazyAnkiNoteManager,
        parseNote: (note: Note) => Promise<ParsedNoteData>,
        progressNotification: ProgressNotification
    ): Promise<{ succeeded: Note[], failed: { [key: string]: Error } }> {
        const failedUpdated: { [key: string]: Error } = {};

        for (const note of notes) {
            try {
                await this.updateNote(note, modelName, graphPath, ankiNoteManager, parseNote);
            } catch (e) {
                console.error(e);
                failedUpdated[`${note.uuid}-${note.type}`] = e;
            }
            progressNotification.increment();
        }

        const updateResult = await ankiNoteManager.executeUpdateNotes();
        for (const failure of updateResult.failedNotes) {
            console.error(failure.error);
            failedUpdated[failure.identifier] = failure.error;
        }

        const succeeded = notes.filter(n => !failedUpdated[`${n.uuid}-${n.type}`]);
        return { succeeded, failed: failedUpdated };
    }

    private async updateNote(
        note: Note,
        modelName: string,
        graphPath: string,
        ankiNoteManager: LazyAnkiNoteManager,
        parseNote: (note: Note) => Promise<ParsedNoteData>
    ): Promise<void> {
        const ankiId = note.getAnkiId();
        const ankiNodeInfo = ankiNoteManager.noteInfoMap.get(ankiId);
        
        const oldConfig = this.parseConfig(ankiNodeInfo.fields.Config.value);
        const [oldHtml, oldAssets, oldDeck, oldBreadcrumb, oldTags, oldExtra] = [
            ankiNodeInfo.fields.Text.value,
            oldConfig.assets,
            ankiNodeInfo.deck,
            ankiNodeInfo.fields.Breadcrumb.value,
            ankiNodeInfo.tags,
            ankiNodeInfo.fields.Extra.value,
        ];

        let dependencyHash = await NoteHashCalculator.getHash(note, [
            oldHtml,
            oldAssets,
            oldDeck,
            oldBreadcrumb,
            oldTags,
            oldExtra,
        ]);

        const { skipOnDependencyHashMatch } = LogseqProxy.Settings.getPluginSettings();
        
        if (skipOnDependencyHashMatch && oldConfig.dependencyHash === dependencyHash) {
            // Just re-add old assets without re-parsing
            oldConfig.assets?.forEach((asset) => {
                if (ankiNoteManager.mediaInfo.has(path.basename(asset))) return;
                ankiNoteManager.storeAsset(
                    path.basename(asset),
                    path.join(graphPath, path.resolve(asset))
                );
            });
            return;
        }

        // Re-parse note and update
        const [html, assets, deck, breadcrumb, tags, extra] = await parseNote(note);
        dependencyHash = await NoteHashCalculator.getHash(note, [
            html,
            assets,
            deck,
            breadcrumb,
            tags,
            extra,
        ]);

        // Store assets
        assets.forEach((asset) => {
            ankiNoteManager.storeAsset(
                path.basename(asset),
                path.join(graphPath, path.resolve(asset))
            );
        });

        const { debug } = LogseqProxy.Settings.getPluginSettings();
        if (debug.includes("syncLogseqToAnki.ts")) {
            console.log(`dependencyHash mismatch for note with id ${note.uuid}-${note.type}`);
        }

        // Update note
        ankiNoteManager.updateNote(
            ankiId,
            deck,
            modelName,
            {
                "uuid-type": `${note.uuid}-${note.type}`,
                uuid: note.uuid,
                Text: html,
                Extra: extra,
                Breadcrumb: breadcrumb,
                Config: JSON.stringify({
                    dependencyHash,
                    assets: [...assets],
                }),
            },
            tags
        );
    }

    private parseConfig(configString: string): any {
        try {
            return JSON.parse(configString);
        } catch (e) {
            return {};
        }
    }
}
```

```typescript
// operations/DeleteNotesOperation.ts
import { LazyAnkiNoteManager } from "../../anki-connect/LazyAnkiNoteManager";
import { ProgressNotification } from "../../ui";

export class DeleteNotesOperation {
    async execute(
        noteIds: number[],
        ankiNoteManager: LazyAnkiNoteManager,
        progressNotification: ProgressNotification
    ): Promise<{ succeeded: number[], failed: { [key: string]: Error } }> {
        const failedDeleted: { [key: string]: Error } = {};

        for (const ankiId of noteIds) {
            ankiNoteManager.deleteNote(ankiId);
            progressNotification.increment();
        }

        const deleteResult = await ankiNoteManager.executeDeleteNotes();
        for (const failure of deleteResult.failedNotes) {
            console.error(failure.error);
            failedDeleted[failure.identifier] = failure.error;
        }

        const succeeded = noteIds.filter(id => !failedDeleted[id.toString()]);
        return { succeeded, failed: failedDeleted };
    }
}
```

#### Changes to syncLogseqToAnki.ts
```typescript
// Replace createNotes(), updateNotes(), deleteNotes() with:
import { CreateNotesOperation } from "./operations/CreateNotesOperation";
import { UpdateNotesOperation } from "./operations/UpdateNotesOperation";
import { DeleteNotesOperation } from "./operations/DeleteNotesOperation";

private async performSync(): Promise<void> {
    // ... existing setup code ...

    const createOp = new CreateNotesOperation();
    const updateOp = new UpdateNotesOperation();
    const deleteOp = new DeleteNotesOperation();

    const createResult = await createOp.execute(
        toCreateNotes,
        this.modelName,
        graphPath,
        ankiNoteManager,
        (note) => this.parseNote(note),
        syncNotificationObj
    );

    const updateResult = await updateOp.execute(
        toUpdateNotes,
        this.modelName,
        graphPath,
        ankiNoteManager,
        (note) => this.parseNote(note),
        syncNotificationObj
    );

    const deleteResult = await deleteOp.execute(
        toDeleteNotes,
        ankiNoteManager,
        syncNotificationObj
    );

    // ... rest of sync logic ...
}
```

#### Benefits
- ✅ Encapsulates operation logic with error tracking
- ✅ Easier to test operations independently
- ✅ Reduces `performSync()` complexity
- ✅ Clear separation between orchestration and execution

---

### Phase 3: Simplify Orchestrator (Medium Risk, High Value)

#### Goal
Refactor `performSync()` to become a clean, readable orchestrator by delegating to extracted modules.

#### Target Result
```typescript
private async performSync(): Promise<void> {
    // Setup
    this.graphName = await this.getGraphName();
    this.modelName = this.getModelName();
    await this.setupAnkiModel();
    const ankiNoteManager = await this.initializeAnkiNoteManager();

    // Collect notes
    const notes = await this.collectAllNotes();
    await this.ensureNotesHaveIds(notes);

    // Plan sync
    const syncPlan = await this.createSyncPlan(notes, ankiNoteManager);
    if (!await this.getUserConfirmation(syncPlan)) {
        this.completeSyncCleanup();
        return;
    }

    // Execute sync
    const results = await this.executeSyncPlan(syncPlan, ankiNoteManager);
    
    // Cleanup and report
    await this.performPostSyncCleanup();
    await this.displayResults(results);
}
```

#### Extracted Helper Methods
```typescript
private async getGraphName(): Promise<string> {
    return _.get(await logseq.App.getCurrentGraph(), "name") || "Default";
}

private getModelName(): string {
    return `${this.graphName}Model`.replace(/\s/g, "_");
}

private async setupAnkiModel(): Promise<void> {
    await AnkiConnect.requestPermission();
    await AnkiConnect.createModel(
        this.modelName,
        ["uuid-type", "uuid", "Text", "Extra", "Breadcrumb", "Config"],
        getTemplateFront(),
        getTemplateBack(),
        getTemplateMediaFiles()
    );
}

private async initializeAnkiNoteManager(): Promise<LazyAnkiNoteManager> {
    const ankiNoteManager = new LazyAnkiNoteManager(this.modelName);
    await ankiNoteManager.init();
    Note.setAnkiNoteManager(ankiNoteManager);
    return ankiNoteManager;
}

private async collectAllNotes(): Promise<Note[]> {
    const scanNotification = new ProgressNotification(
        `Scanning Logseq Graph <span style="opacity: 0.8">[${this.graphName}]</span>:`,
        5,
        "graph"
    );
    
    let notes: Array<Note> = [];
    notes = [...notes, ...(await ClozeNote.getNotesFromLogseqBlocks())];
    scanNotification.increment();
    notes = [...notes, ...(await SwiftArrowNote.getNotesFromLogseqBlocks())];
    scanNotification.increment();
    notes = [...notes, ...(await ImageOcclusionNote.getNotesFromLogseqBlocks())];
    scanNotification.increment();
    notes = [...notes, ...(await MultilineCardNote.getNotesFromLogseqBlocks(notes))];
    scanNotification.increment();
    await new Promise((resolve) => setTimeout(resolve, 1000));
    scanNotification.increment();

    return await sortAsync(notes, async (a) => {
        return _.get(await LogseqProxy.Editor.getBlock(a.uuid), "id", 0);
    });
}

private async ensureNotesHaveIds(notes: Note[]): Promise<void> {
    for (const note of notes) {
        if (!note.properties["id"]) {
            try {
                await LogseqProxy.Editor.upsertBlockProperty(note.uuid, "id", note.uuid);
            } catch (e) {
                console.error(e);
            }
        }
    }
}

private completeSyncCleanup(): void {
    WindowParentBridge.dispatchLogseqAnkiSyncEvent("syncLogseqToAnkiComplete");
    console.log("Sync Aborted by user!");
}
```

#### Benefits
- ✅ `performSync()` reduced from ~300 to ~100 lines
- ✅ Each helper method has clear purpose
- ✅ Easy to understand sync flow at a glance
- ✅ Easy to modify individual steps

---

## Testing Strategy

### Current State
- Hard to test `parseNote()` logic without full sync context
- Cannot test individual parsing rules

### After Refactoring
```typescript
// tests/sync/parsers/DeckParser.test.ts
describe('DeckParser', () => {
    it('should use block deck property over namespace', async () => {
        const note = createMockNote({ /* ... */ });
        const deck = await DeckParser.parse(note);
        expect(deck).toBe('BlockDeck');
    });
    
    it('should fall back to namespace when no block deck', async () => {
        // Test specific edge case in isolation
    });
});

// tests/sync/operations/UpdateNotesOperation.test.ts
describe('UpdateNotesOperation', () => {
    it('should skip re-parsing when hash matches', async () => {
        const mockNote = createMockNote({ /* ... */ });
        const mockManager = createMockAnkiNoteManager(/* ... */);
        const operation = new UpdateNotesOperation();
        
        const result = await operation.execute(/* ... */);
        
        expect(result.succeeded).toHaveLength(1);
        expect(parseNoteSpy).not.toHaveBeenCalled(); // Should skip parsing
    });
});
```

---

## Migration Path

### Step-by-step (Zero Downtime)
1. ✅ Create `REFACTOR_SYNCLOGSEQTOANKI.md` (this document)
2. Create new parser modules alongside existing code (Phase 1)
3. Update `parseNote()` to delegate to new parsers (behavior unchanged)
4. Add tests for new parsers
5. Extract operations (create/update/delete) into operation classes (Phase 2)
6. Update `performSync()` to use new operations
7. Add tests for operations
8. Simplify orchestrator with helper methods (Phase 3)
9. Move cache files into `cache/` subfolder for better organization
10. Final cleanup and documentation

### Risk Mitigation
- ✅ Each step maintains existing behavior
- ✅ Tests validate no regressions
- ✅ Can pause refactoring at any step
- ✅ Old code can coexist with new code during transition
- ✅ No changes to public API or external behavior

---

## Success Metrics

### Code Quality
- ✅ Average method length < 50 lines
- ✅ Each class/module has single responsibility
- ✅ Test coverage > 80% for parsing logic
- ✅ `performSync()` reduced from ~300 to ~100 lines

### Developer Experience
- ✅ New features can be added without touching orchestrator
- ✅ Bugs in parsing are isolated to single file
- ✅ New developers can understand sync flow in < 30 minutes
- ✅ Each parser can be understood and tested independently

### Performance
- ⚠️ Should be neutral (no perf regression)
- ⚠️ Consider measuring sync time before/after each phase

---

## Additional Considerations

### Cache Organization
After the main refactoring phases, organize cache-related files:
```
src/sync/cache/
├── index.ts
├── BlockAndPageHashCache.ts
└── NoteHashCalculator.ts
```

**Benefits:**
- Groups related functionality together
- Makes the sync folder cleaner and more organized
- Easy to find cache-related code
- Clearer separation of concerns

**Migration:**
```typescript
// Before
import NoteHashCalculator from "./NoteHashCalculator";
import * as blockAndPageHashCache from "./blockAndPageHashCache";

// After
import { NoteHashCalculator } from "./cache";
import { blockAndPageHashCache } from "./cache";
```

### Hash Cache Invalidation
Current system clears cache on `syncLogseqToAnkiComplete` event. After refactoring:
- Keep cache clearing in orchestrator
- Ensure event dispatch remains in the right place (end of `performSync()`)
- Cache initialization stays in `src/index.ts`

### Anki Model Management
Currently done in `performSync()`. After Phase 3:
- Model setup becomes a clearly named helper method `setupAnkiModel()`
- Easy to extract to service later if needed

### Asset Management
Asset storage is handled within operations. This is appropriate because:
- Assets are tightly coupled to note creation/updates
- AssetOperation already handles batching and deduplication
- No need for further extraction

### Error Handling
Operations return `{ succeeded, failed }` objects:
- Maintains current error tracking approach
- Easy to aggregate errors at orchestrator level
- Could be enhanced with Result types in future if needed

---

## Conclusion

**Approach**: Hybrid Module + Minimal Services

**Why**:
1. Balances complexity vs. benefit
2. Incremental migration path (3 phases)
3. Testing becomes feasible at each layer
4. Maintains existing architecture philosophy (modules over heavy OOP)
5. Aligns with existing patterns in codebase (e.g., `LazyAnkiNoteManager` uses operations)

**Next Steps**:
1. Review this document
2. Get approval on approach
3. Start with Phase 1 (Extract Parsers) - lowest risk, immediate value
4. Iterate based on feedback

**Estimated Effort**: 
- Phase 1 (Extract Parsers): 4-6 hours
- Phase 2 (Extract Operations): 6-8 hours  
- Phase 3 (Simplify Orchestrator): 3-4 hours
- Cache Organization: 1-2 hours
- **Total: ~14-20 hours** of focused work spread over 3-4 PRs

Each phase is independently valuable and can be merged separately. Cache organization can be done as part of Phase 3 or as a separate cleanup PR.
