# LogseqToHtmlConverter Refactoring Proposal for Graph DB Mode Support

## Executive Summary

The current `LogseqToHtmlConverter.ts` implementation is tightly coupled to Logseq's **Files mode**, where pages and assets are stored as individual markdown/org files in a filesystem. With Logseq's introduction of **Graph DB mode**, where content is stored in a database, the converter needs significant refactoring to support both modes.

This document proposes a comprehensive refactoring strategy to make the converter mode-agnostic while maintaining backward compatibility.

---

## Current State Analysis

### Key Issues with Files Mode Assumptions

1. **Asset Path Resolution** (Line 337, 615-621, 639-643, 664-668)
   - Uses `page.originalName` to construct filesystem paths: `../assets/${_.get(page, "originalName", "").replace("hls__", "")}/...`
   - Assumes assets are in `../assets/` directory relative to pages
   - Uses `path.basename()` to extract filenames from filesystem paths
   - In DB mode, `originalName` may not exist or have different semantics

2. **Page Reference Handling** (Line 5-6 in getNameFromPage.ts)
   ```typescript
   return (
       _.get(page, "originalName", null) ||
       _.get(page, "name", null) ||
       null
   );
   ```
   - Fallback logic assumes `originalName` is primary identifier
   - In DB mode, pages may only have `name` property

3. **Asset Listing** (NoteHashCalculator.ts:31)
   - Uses `LogseqProxy.Assets.listFilesOfCurrentGraph()` to get all assets
   - This API may not work or return different results in DB mode

4. **Asset Path Construction for Anki** (UpdateNotesOperation.ts:76, CreateNotesOperation.ts:76)
   ```typescript
   path.join(graphPath, path.resolve(asset))
   ```
   - Assumes `graphPath` is a filesystem directory
   - In DB mode, `graphPath` might be a database connection string or have different semantics

5. **PDF Annotation Paths** (Line 337)
   ```typescript
   const hls_img_loc = `../assets/${_.get(page, "originalName", "").replace(
       "hls__",
       "",
   )}/${block_props["hl-page"]}_${block_uuid}_${
       block_props["hl-stamp"]
   }.png?imageAnnotationBlockUUID=${block_uuid}`;
   ```
   - Hardcoded path structure for PDF annotations
   - Assumes `hls__` prefix convention

6. **Graph Detection** (syncLogseqToAnki.ts:42-44)
   ```typescript
   // if (await LogseqProxy.App.checkCurrentIsDbGraph()  === true) {
   //     await logseq.UI.showMsg("Anki sync not supported in DB Graphs yet.\nDevelopment to support it is going on in db branch.", "error");
   //     return;
   // }
   ```
   - Currently commented out - indicates DB mode support was planned but not implemented

---

## Differences Between Files Mode and Graph DB Mode

| Aspect | Files Mode | Graph DB Mode |
|--------|-----------|---------------|
| **Page Storage** | Individual `.md`/`.org` files | Database records |
| **Page Identifier** | `originalName` (filename without extension) | `name` (database record name) |
| **Asset Storage** | Files in `assets/` directory | Database BLOBs or external storage |
| **Asset References** | Relative file paths (`../assets/image.png`) | Asset UUIDs or database references |
| **PDF Annotations** | `assets/hls__filename/page_uuid_stamp.png` | Database-managed or different structure |
| **Graph Path** | Filesystem directory path | Database identifier or connection string |
| **Asset Listing API** | `listFilesOfCurrentGraph()` returns file paths | May return asset metadata/UUIDs |

---

## Proposed Refactoring Strategy

### Phase 1: Create Abstraction Layer

#### 1.1 Asset Resolver Interface

Create a new abstraction to handle mode-specific asset resolution:

```typescript
// src/logseq/AssetResolver.ts

export interface AssetMetadata {
    identifier: string;      // Filename or UUID
    path: string;           // Path for Files mode, URL for DB mode
    modifiedTime: number;
    type: 'image' | 'audio' | 'video' | 'pdf' | 'other';
}

export interface IAssetResolver {
    /**
     * Resolves an asset reference to a path usable in Anki
     * @param assetRef - Asset reference from Logseq (path, UUID, etc.)
     * @returns Absolute path for Anki media collection
     */
    resolveAssetForAnki(assetRef: string): Promise<string>;
    
    /**
     * Resolves an asset reference to a path usable in HTML
     * @param assetRef - Asset reference from Logseq
     * @returns Relative or absolute URL for HTML embedding
     */
    resolveAssetForHTML(assetRef: string): Promise<string>;
    
    /**
     * Resolves PDF annotation image path
     */
    resolvePDFAnnotation(
        pageEntity: PageEntity,
        blockUUID: string,
        pageNumber: string,
        timestamp: string
    ): Promise<string>;
    
    /**
     * Lists all assets in current graph
     */
    listAssets(): Promise<AssetMetadata[]>;
    
    /**
     * Gets the base path for graph assets
     */
    getGraphAssetsBasePath(): Promise<string>;
}
```

#### 1.2 Files Mode Implementation

```typescript
// src/logseq/FilesAssetResolver.ts

export class FilesAssetResolver implements IAssetResolver {
    private graphPath: string;
    
    constructor(graphPath: string) {
        this.graphPath = graphPath;
    }
    
    async resolveAssetForAnki(assetRef: string): Promise<string> {
        // Current logic: path.join(graphPath, path.resolve(asset))
        return path.join(this.graphPath, path.resolve(assetRef));
    }
    
    async resolveAssetForHTML(assetRef: string): Promise<string> {
        // Current logic: path.basename(assetRef).split("?")[0]
        return path.basename(assetRef).split("?")[0];
    }
    
    async resolvePDFAnnotation(
        pageEntity: PageEntity,
        blockUUID: string,
        pageNumber: string,
        timestamp: string
    ): Promise<string> {
        const pageName = _.get(pageEntity, "originalName", "");
        const cleanPageName = pageName.replace("hls__", "");
        return `../assets/${cleanPageName}/${pageNumber}_${blockUUID}_${timestamp}.png?imageAnnotationBlockUUID=${blockUUID}`;
    }
    
    async listAssets(): Promise<AssetMetadata[]> {
        const files = await LogseqProxy.Assets.listFilesOfCurrentGraph();
        return files.map(file => ({
            identifier: path.basename(file.path),
            path: file.path,
            modifiedTime: file.modifiedTime,
            type: this.detectAssetType(file.path)
        }));
    }
    
    async getGraphAssetsBasePath(): Promise<string> {
        return path.join(this.graphPath, 'assets');
    }
    
    private detectAssetType(filepath: string): AssetMetadata['type'] {
        if (filepath.match(isImage_REGEXP)) return 'image';
        if (filepath.match(isAudio_REGEXP)) return 'audio';
        if (filepath.match(isVideo_REGEXP)) return 'video';
        if (filepath.endsWith('.pdf')) return 'pdf';
        return 'other';
    }
}
```

#### 1.3 Graph DB Mode Implementation

```typescript
// src/logseq/DBAssetResolver.ts

export class DBAssetResolver implements IAssetResolver {
    private graphName: string;
    
    constructor(graphName: string) {
        this.graphName = graphName;
    }
    
    async resolveAssetForAnki(assetRef: string): Promise<string> {
        // DB mode: assets might be referenced by UUID
        // Need to fetch asset data and write to temp file
        // Or use Logseq API to export asset
        
        // TODO: Implement based on Logseq DB API
        // Possible approaches:
        // 1. Use logseq.Assets.getAsset(uuid) to fetch blob
        // 2. Export to temp directory
        // 3. Return path to temp file
        
        throw new Error("DB mode asset resolution not yet implemented");
    }
    
    async resolveAssetForHTML(assetRef: string): Promise<string> {
        // DB mode: might use logseq:// protocol or data URLs
        // For inline display, might need to use base64 encoding
        
        // TODO: Implement based on how Logseq DB handles asset refs
        throw new Error("DB mode HTML asset resolution not yet implemented");
    }
    
    async resolvePDFAnnotation(
        pageEntity: PageEntity,
        blockUUID: string,
        pageNumber: string,
        timestamp: string
    ): Promise<string> {
        // DB mode: PDF annotations stored differently
        // Might use asset UUID or direct database query
        
        // TODO: Research how DB mode stores PDF annotations
        throw new Error("DB mode PDF annotation resolution not yet implemented");
    }
    
    async listAssets(): Promise<AssetMetadata[]> {
        // DB mode: Query database for asset records
        // May need different API call or datascript query
        
        try {
            // Attempt to use existing API (might work in DB mode)
            const files = await LogseqProxy.Assets.listFilesOfCurrentGraph();
            return files.map(file => ({
                identifier: file.path, // Might be UUID in DB mode
                path: file.path,
                modifiedTime: file.modifiedTime,
                type: this.detectAssetType(file.path)
            }));
        } catch (e) {
            console.warn("listFilesOfCurrentGraph failed in DB mode, falling back to datascript query");
            // TODO: Implement datascript query for assets
            return [];
        }
    }
    
    async getGraphAssetsBasePath(): Promise<string> {
        // DB mode: No filesystem base path
        // Return database identifier or temp directory
        return `db://${this.graphName}/assets`;
    }
    
    private detectAssetType(ref: string): AssetMetadata['type'] {
        // In DB mode, might need to query asset metadata
        // For now, use same regex patterns
        if (ref.match(isImage_REGEXP)) return 'image';
        if (ref.match(isAudio_REGEXP)) return 'audio';
        if (ref.match(isVideo_REGEXP)) return 'video';
        if (ref.endsWith('.pdf')) return 'pdf';
        return 'other';
    }
}
```

#### 1.4 Asset Resolver Factory

```typescript
// src/logseq/AssetResolverFactory.ts

export class AssetResolverFactory {
    private static instance: IAssetResolver | null = null;
    
    static async create(): Promise<IAssetResolver> {
        if (this.instance) return this.instance;
        
        const isDBGraph = await LogseqProxy.App.checkCurrentIsDbGraph();
        
        if (isDBGraph) {
            const graphName = _.get(await logseq.App.getCurrentGraph(), "name");
            this.instance = new DBAssetResolver(graphName);
        } else {
            const graphPath = (await logseq.App.getCurrentGraph()).path;
            this.instance = new FilesAssetResolver(graphPath);
        }
        
        return this.instance;
    }
    
    static reset() {
        this.instance = null;
    }
}

// Reset on graph change
LogseqProxy.App.registerGraphChangeListener(() => {
    AssetResolverFactory.reset();
});

WindowParentBridge.addEventListener("syncLogseqToAnkiComplete", () => {
    AssetResolverFactory.reset();
});
```

---

### Phase 2: Create Page Name Resolver

#### 2.1 Page Identity Interface

```typescript
// src/logseq/PageIdentityResolver.ts

export interface IPageIdentityResolver {
    /**
     * Gets the canonical name for a page
     */
    getPageName(page: PageEntity): string;
    
    /**
     * Gets the display name for a page
     */
    getPageDisplayName(page: PageEntity): string;
}

export class FilesPageIdentityResolver implements IPageIdentityResolver {
    getPageName(page: PageEntity): string {
        // Files mode: originalName is the filename without extension
        return _.get(page, "originalName", null) || _.get(page, "name", null) || "";
    }
    
    getPageDisplayName(page: PageEntity): string {
        return this.getPageName(page);
    }
}

export class DBPageIdentityResolver implements IPageIdentityResolver {
    getPageName(page: PageEntity): string {
        // DB mode: name is the canonical identifier
        return _.get(page, "name", null) || _.get(page, "originalName", null) || "";
    }
    
    getPageDisplayName(page: PageEntity): string {
        return this.getPageName(page);
    }
}

export class PageIdentityResolverFactory {
    private static instance: IPageIdentityResolver | null = null;
    
    static async create(): Promise<IPageIdentityResolver> {
        if (this.instance) return this.instance;
        
        const isDBGraph = await LogseqProxy.App.checkCurrentIsDbGraph();
        this.instance = isDBGraph 
            ? new DBPageIdentityResolver() 
            : new FilesPageIdentityResolver();
        
        return this.instance;
    }
    
    static reset() {
        this.instance = null;
    }
}
```

---

### Phase 3: Refactor LogseqToHtmlConverter

#### 3.1 Dependency Injection

Refactor `convertToHTMLFile` and helper functions to accept resolver dependencies:

```typescript
// src/logseq/LogseqToHtmlConverter.ts

export interface ConverterContext {
    assetResolver: IAssetResolver;
    pageIdentityResolver: IPageIdentityResolver;
    graphName: string;
}

export async function convertToHTMLFile(
    content: string,
    format = "markdown",
    opts: { 
        processRefEmbeds?: boolean; 
        displayTags?: boolean;
        context?: ConverterContext; // New parameter
    } = { processRefEmbeds: true, displayTags: false }
): Promise<HTMLFile> {
    // Create context if not provided
    const context = opts.context || await createDefaultContext();
    
    // Pass context through all function calls
    // ... rest of implementation
}

async function createDefaultContext(): Promise<ConverterContext> {
    return {
        assetResolver: await AssetResolverFactory.create(),
        pageIdentityResolver: await PageIdentityResolverFactory.create(),
        graphName: _.get(await logseq.App.getCurrentGraph(), "name") || "Default"
    };
}
```

#### 3.2 Refactor processProperties

```typescript
export async function processProperties(
    resultContent: string, 
    format: string = "markdown",
    context: ConverterContext
): Promise<[string, any]> {
    // ... existing property processing logic ...
    
    if (block_props["ls-type"] == "annotation" && block_props["hl-type"] == "area") {
        try {
            const block_uuid = block_props["id"] || block_props["nid"];
            const block = await LogseqProxy.Editor.getBlock(block_uuid);
            const page = await LogseqProxy.Editor.getPage(_.get(block, "page.id") as number | PageIdentity);
            
            // Use asset resolver instead of hardcoded path
            const hls_img_loc = await context.assetResolver.resolvePDFAnnotation(
                page,
                block_uuid,
                block_props["hl-page"],
                block_props["hl-stamp"]
            );
            
            resultContent =
                `${annotationSymbolMap[block_props["hl-color"]] || '\ud83d\udccc'}**P${block_props["hl-page"]}** <div></div> ![](${hls_img_loc})\n` +
                resultContent;
        } catch (e) {
            console.log(e);
        }
    }
    // ... rest of implementation
}
```

#### 3.3 Refactor processLink

```typescript
async function processLink(
    node,
    start_pos,
    end_pos,
    resultContent,
    resultAssets,
    resultUTF8,
    hashmap,
    format,
    context: ConverterContext // Add context parameter
) {
    // ... existing parsing logic ...
    
    // Image Display
    if (/* image conditions */) {
        const str = getRandomUnicodeString();
        
        // Use asset resolver for HTML path
        const htmlPath = await context.assetResolver.resolveAssetForHTML(link_url);
        
        hashmap[str] = `<img src="${htmlPath}" ${
            link_label_text ? `alt="${link_label_text}"` : ``
        } ${metadata && metadata.width ? `width="${metadata.width}"` : ``} ${
            metadata && metadata.height ? `height="${metadata.height}"` : ``
        }/>`;
        
        // Track asset for Anki
        resultAssets.add(link_url.split("?")[0]);
        
        return new Uint8Array([
            ...resultUTF8.subarray(0, start_pos),
            ...new TextEncoder().encode(str),
            ...resultUTF8.subarray(end_pos),
        ]);
    }
    
    // Audio Display
    if (/* audio conditions */) {
        const str = getRandomUnicodeString();
        const htmlPath = await context.assetResolver.resolveAssetForHTML(link_url);
        hashmap[str] = `[sound:${htmlPath}]`;
        resultAssets.add(link_url.split("?")[0]);
        // ... return statement
    }
    
    // Video Display
    if (/* video conditions */) {
        const str = getRandomUnicodeString();
        const htmlPath = await context.assetResolver.resolveAssetForHTML(link_url);
        hashmap[str] = `<video src="${htmlPath}" controlsList="nodownload" controls></video>`;
        resultAssets.add(link_url.split("?")[0]);
        // ... return statement
    }
    
    // ... rest of implementation
}
```

#### 3.4 Refactor processRefEmbeds

```typescript
async function processRefEmbeds(
    resultContent,
    resultAssets,
    resultTags,
    hashmap,
    format,
    context: ConverterContext // Add context parameter
): Promise<string> {
    // ... existing block/page embed logic ...
    
    resultContent = await safeReplaceAsync(
        resultContent,
        LOGSEQ_PAGE_REF_REGEXP,
        async (match, pageName) => {
            const str = getRandomUnicodeString();
            hashmap[str] = `<a href="logseq://graph/${encodeURIComponent(
                context.graphName // Use context instead of querying
            )}?page=${encodeURIComponent(pageName)}" class="page-reference">${pageName}</a>`;
            return str;
        },
    );
    
    // ... rest of implementation
}
```

---

### Phase 4: Refactor Sync Operations

#### 4.1 Update CreateNotesOperation

```typescript
// src/sync/operations/CreateNotesOperation.ts

export class CreateNotesOperation {
    async execute(
        notes: Note[],
        modelName: string,
        assetResolver: IAssetResolver, // Change from graphPath
        ankiNoteManager: LazyAnkiNoteManager,
        parseNote: (note: Note) => Promise<ParsedNoteData>,
        progressNotification: ProgressNotification
    ): Promise<OperationResult> {
        // ... existing logic ...
        
        for (const note of notes) {
            // ... parse note ...
            
            for (const asset of assets) {
                try {
                    // Use asset resolver instead of path.join
                    const assetPath = await assetResolver.resolveAssetForAnki(asset);
                    ankiNoteManager.storeMediaFileByPath(assetPath);
                } catch (e) {
                    console.error(`Failed to resolve asset: ${asset}`, e);
                }
            }
            
            // ... rest of implementation
        }
    }
}
```

#### 4.2 Update UpdateNotesOperation

```typescript
// src/sync/operations/UpdateNotesOperation.ts

export class UpdateNotesOperation {
    async execute(
        notes: Note[],
        modelName: string,
        assetResolver: IAssetResolver, // Change from graphPath
        ankiNoteManager: LazyAnkiNoteManager,
        parseNote: (note: Note) => Promise<ParsedNoteData>,
        progressNotification: ProgressNotification
    ): Promise<OperationResult> {
        // Similar changes as CreateNotesOperation
        // Use assetResolver.resolveAssetForAnki() instead of path.join
    }
}
```

#### 4.3 Update LogseqToAnkiSync

```typescript
// src/sync/syncLogseqToAnki.ts

export class LogseqToAnkiSync {
    private assetResolver: IAssetResolver;
    
    private async performSync(): Promise<void> {
        // Initialize asset resolver early
        this.assetResolver = await AssetResolverFactory.create();
        
        // ... existing logic ...
        
        // Remove this check (or show better message)
        // if (await LogseqProxy.App.checkCurrentIsDbGraph() === true) {
        //     await logseq.UI.showMsg("Anki sync not supported in DB Graphs yet...", "error");
        //     return;
        // }
    }
    
    private async createNotes(
        toCreateNotes: Note[],
        failedCreated: { [key: string]: Error },
        ankiNoteManager: LazyAnkiNoteManager,
        syncNotificationObj: ProgressNotification,
    ): Promise<void> {
        // Pass assetResolver instead of graphPath
        const operation = new CreateNotesOperation();
        const result = await operation.execute(
            toCreateNotes,
            this.modelName,
            this.assetResolver, // Changed from graphPath
            ankiNoteManager,
            (note) => this.parseNote(note),
            syncNotificationObj
        );
        Object.assign(failedCreated, result.failed);
    }
    
    private async updateNotes(/* ... */): Promise<void> {
        // Similar changes for update
    }
}
```

---

### Phase 5: Update NoteHashCalculator

```typescript
// src/sync/cache/NoteHashCalculator.ts

export default class NoteHashCalculator {
    private static async getAssetModifiedTimeMap(
        assetResolver: IAssetResolver
    ): Promise<Map<string, number>> {
        const assetModifiedTimeMap = new Map<string, number>();
        try {
            const assets = await assetResolver.listAssets();
            for (const asset of assets) {
                assetModifiedTimeMap.set(asset.identifier, asset.modifiedTime);
            }
        } catch (e) {
            console.error("[NoteHashCalculator] Error getting asset modified times:", e);
        }
        return assetModifiedTimeMap;
    }
    
    public static async getHash(
        note: Note, 
        ankiFields: ParsedNoteData,
        assetResolver: IAssetResolver // Add parameter
    ): Promise<number> {
        // ... existing logic ...
        
        // Get asset modified times using resolver
        const assetModifiedTimeMap = await this.getAssetModifiedTimeMap(assetResolver);
        const assetsWithModifiedTime = assetsArray.map((assetPath: string) => {
            // In DB mode, assetPath might be UUID
            const identifier = assetPath; // Or extract identifier based on mode
            const modifiedTime = assetModifiedTimeMap.get(identifier) || 0;
            return modifiedTime;
        });
        
        // ... rest of implementation
    }
}
```

---

### Phase 6: Update Other Components

#### 6.1 Update getNameFromPage.ts

```typescript
// src/logseq/getNameFromPage.ts

export default async function getNameFromPage(page: PageEntity): Promise<string> {
    const resolver = await PageIdentityResolverFactory.create();
    return resolver.getPageName(page);
}

// For backward compatibility, add synchronous version
export function getNameFromPageSync(page: PageEntity): string {
    // Use simple fallback logic for sync contexts
    return _.get(page, "originalName", null) || _.get(page, "name", null) || "";
}
```

#### 6.2 Update Note.ts

```typescript
// src/anki-notes/Note.ts

export abstract class Note {
    public constructor(
        uuid: string,
        content: string,
        format: string,
        properties: any,
        page: PageEntity,
        tags: string[],
    ) {
        this.uuid = uuid;
        this.content = content;
        this.format = format;
        this.properties = properties;
        this.page = page;
        
        // Use synchronous version for constructor
        // Later refactor to make constructor async or lazy-load page name
        this.page.name = this.page.originalName = getNameFromPageSync(page);
        
        this.tags = tags;
    }
    
    // ... rest of implementation
}
```

---

## Implementation Phases and Timeline

### Phase 1: Foundation (Week 1-2)
- [ ] Create `IAssetResolver` interface
- [ ] Implement `FilesAssetResolver` (extract existing logic)
- [ ] Implement `AssetResolverFactory`
- [ ] Add unit tests for Files mode (should pass with existing logic)
- [ ] Create `IPageIdentityResolver` interface
- [ ] Implement both resolver types

### Phase 2: Refactor LogseqToHtmlConverter (Week 3-4)
- [ ] Add `ConverterContext` parameter to all functions
- [ ] Refactor `processProperties` to use `assetResolver`
- [ ] Refactor `processLink` to use `assetResolver`
- [ ] Refactor `processRefEmbeds` to use context
- [ ] Update all call sites
- [ ] Test Files mode still works correctly

### Phase 3: Refactor Sync Operations (Week 5)
- [ ] Update `CreateNotesOperation` to accept `IAssetResolver`
- [ ] Update `UpdateNotesOperation` to accept `IAssetResolver`
- [ ] Update `LogseqToAnkiSync` to use asset resolver
- [ ] Update `NoteHashCalculator` to use asset resolver
- [ ] Test end-to-end sync in Files mode

### Phase 4: DB Mode Research and Implementation (Week 6-8)
- [ ] Research Logseq DB asset storage mechanism
- [ ] Implement `DBAssetResolver.listAssets()`
- [ ] Implement `DBAssetResolver.resolveAssetForAnki()`
- [ ] Implement `DBAssetResolver.resolveAssetForHTML()`
- [ ] Implement `DBAssetResolver.resolvePDFAnnotation()`
- [ ] Test basic DB mode asset handling

### Phase 5: Integration and Testing (Week 9-10)
- [ ] Create integration tests for both modes
- [ ] Test with real Logseq graphs (Files and DB)
- [ ] Handle edge cases (missing assets, malformed paths, etc.)
- [ ] Performance testing
- [ ] Documentation updates

### Phase 6: Polish and Release (Week 11-12)
- [ ] User-facing documentation
- [ ] Migration guide
- [ ] Release notes
- [ ] Monitor for issues

---

## Benefits of This Approach

### 1. **Clean Separation of Concerns**
- Asset resolution logic isolated in dedicated classes
- Converter focuses on HTML generation, not path management
- Easy to test each component independently

### 2. **Backward Compatibility**
- Files mode logic extracted, not rewritten
- Existing tests should pass with minimal changes
- No breaking changes for current users

### 3. **Extensibility**
- Easy to add new storage modes in future
- Easy to add new asset types
- Clear extension points for plugins/addons

### 4. **Maintainability**
- Clear interfaces document expected behavior
- Mode-specific logic contained in respective implementations
- Easier to debug mode-specific issues

### 5. **Testability**
- Mock resolvers for unit tests
- Test Files and DB modes independently
- Integration tests can verify both modes

---

## Open Questions and Research Needed

### DB Mode Specifics (Requires Investigation)

1. **Asset Storage**
   - How are assets stored in DB mode? (BLOBs, external storage, hybrid?)
   - What API is available to retrieve assets?
   - Can we use `listFilesOfCurrentGraph()` in DB mode?

2. **Asset References**
   - How are assets referenced in DB mode? (UUIDs, paths, something else?)
   - How to convert DB asset references to filesystem paths for Anki?
   - Do we need a temporary export directory?

3. **PDF Annotations**
   - How are PDF annotations stored in DB mode?
   - Is the `hls__` prefix convention still used?
   - Where are annotation images stored?

4. **Page Properties**
   - Is `originalName` still present in DB mode?
   - What is the relationship between `name` and `originalName`?
   - Are there new properties we should use?

5. **Performance**
   - How expensive are asset retrieval operations in DB mode?
   - Should we cache asset resolutions?
   - Do we need batch asset operations?

### Logseq API Clarifications Needed

- [ ] Test `logseq.App.checkCurrentIsDbGraph()` behavior
- [ ] Test `logseq.Assets.listFilesOfCurrentGraph()` in DB mode
- [ ] Check if there are new APIs for DB-specific asset management
- [ ] Verify `page.name` vs `page.originalName` semantics in both modes

---

## Risk Analysis

### High Risk Areas

1. **Asset Retrieval in DB Mode**
   - **Risk**: API might not support exporting assets to filesystem
   - **Mitigation**: Research Logseq DB API thoroughly; contact Logseq team if needed
   - **Fallback**: Create temporary export mechanism

2. **PDF Annotations**
   - **Risk**: Annotation structure might be completely different in DB mode
   - **Mitigation**: Test with actual DB graphs containing annotations
   - **Fallback**: Disable annotation support initially for DB mode

3. **Performance**
   - **Risk**: Asset resolution might be slow in DB mode
   - **Mitigation**: Implement caching at resolver level
   - **Fallback**: Batch operations, progress indicators

### Medium Risk Areas

1. **Backward Compatibility**
   - **Risk**: Refactoring might break existing workflows
   - **Mitigation**: Comprehensive testing, gradual rollout
   - **Fallback**: Feature flag to use old code path

2. **Testing Coverage**
   - **Risk**: Hard to test DB mode without actual DB graphs
   - **Mitigation**: Create test DB graphs, mock resolver interfaces
   - **Fallback**: Beta testing with DB mode users

---

## Success Criteria

1. **Functional**
   - [ ] Files mode continues to work identically to current implementation
   - [ ] DB mode can sync notes with assets to Anki
   - [ ] PDF annotations work in both modes
   - [ ] All asset types (images, audio, video) work in both modes

2. **Performance**
   - [ ] No significant performance regression in Files mode
   - [ ] DB mode sync completes in reasonable time (<2x Files mode)
   - [ ] Asset resolution caching works effectively

3. **Code Quality**
   - [ ] Test coverage >80% for new code
   - [ ] No circular dependencies
   - [ ] Clear, documented interfaces
   - [ ] Follows existing code style

4. **User Experience**
   - [ ] No breaking changes for Files mode users
   - [ ] Clear error messages for DB mode issues
   - [ ] Smooth migration path from commented-out DB check

---

## Alternative Approaches Considered

### Alternative 1: Mode Detection in Every Function
**Approach**: Add `if (isDBGraph)` checks throughout existing code

**Pros**: Minimal refactoring, quick to implement

**Cons**: 
- Increases complexity and code duplication
- Hard to test and maintain
- Violates single responsibility principle
- Difficult to extend for future modes

**Verdict**: ❌ Not recommended

### Alternative 2: Complete Rewrite
**Approach**: Start from scratch with new architecture

**Pros**: Clean slate, optimal design

**Cons**:
- High risk of breaking existing functionality
- Massive time investment
- Difficult to test incrementally
- No backward compatibility guarantee

**Verdict**: ❌ Too risky

### Alternative 3: Adapter Pattern with Minimal Changes
**Approach**: Create thin adapter layer, keep existing code mostly intact

**Pros**: Lower risk, faster implementation

**Cons**:
- Doesn't fully address technical debt
- Still leaves mode-specific logic scattered
- Harder to test comprehensively

**Verdict**: ⚠️ Possible fallback if full refactoring is too complex

### Selected Approach: Strategy Pattern with Dependency Injection
**Pros**:
- Clean separation of concerns
- Testable and maintainable
- Extensible for future modes
- Preserves existing Files mode logic
- Gradual implementation possible

**Cons**:
- Requires significant refactoring
- Need to update many call sites
- Slightly more complex initial implementation

**Verdict**: ✅ Recommended - Best balance of quality and risk

---

## Conclusion

This refactoring proposal provides a comprehensive, maintainable path to supporting both Logseq Files mode and Graph DB mode. By introducing clear abstraction layers and following SOLID principles, we can:

1. Support both modes without code duplication
2. Maintain backward compatibility for Files mode
3. Create a foundation for future extensibility
4. Improve testability and maintainability

The key to success will be:
- Thorough research of DB mode asset handling
- Incremental implementation with continuous testing
- Close collaboration with Logseq community for DB mode specifics
- Comprehensive testing in both modes before release

**Next Steps**:
1. Review and approve this proposal
2. Research DB mode asset handling (contact Logseq team if needed)
3. Begin Phase 1 implementation
4. Set up DB mode test environment
5. Implement incrementally with continuous integration testing
