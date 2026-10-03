import {createLogger, LoggerCategory} from "../../../logger";
import {LogseqPluginStorageManager as Storage} from "../../../logseq/LogseqPluginStorageManager";
import {
    assertRelativeStoragePath,
    assertStorageFileTree
} from "../../../logseq/LogseqPluginStorageManager/relativeStoragePath";
import {parseSkillFile} from "../../skill-parser/parseSkillFile";
import {skillNameSchema} from "../../skill-parser/skillMetadataSchema";
import {validateFrontmatterTemplate} from "../../template-engine/parser/validateFrontmatterTemplate";
import {hashSkillFileSnapshot} from "./hashSkillFileSnapshot";
import type {
    BundledSkill,
    EditedSkill,
    HashOptions,
    SaveSkillFileOptions,
    SkillFileData,
    SkillFolderFiles,
    StoredSkill
} from "./types";

const logger = createLogger(LoggerCategory.PLUGIN_STORAGE);

/** Skill folders and their text resources, independent of model/UI policy. */
export class SkillStore {
    static readonly groupName = "skills";
    private static mutationQueue: Promise<unknown> = Promise.resolve();

    private static serializeMutation<T>(operation: () => Promise<T>): Promise<T> {
        const result = SkillStore.mutationQueue.then(operation);
        SkillStore.mutationQueue = result.catch(() => {});
        return result;
    }

    private static folderGroup(name: string): string {
        return `${SkillStore.groupName}/${skillNameSchema.parse(name)}`;
    }

    private static parseContent(content: string): SkillFileData {
        return parseSkillFile(content);
    }

    static async getSkill(name: string): Promise<StoredSkill | null> {
        const content = await Storage.getFileContent(SkillStore.folderGroup(name), "SKILL.md");
        if (content === undefined) return null;
        try {
            const skill = SkillStore.parseContent(content);
            if (skill.name !== name) throw new Error("Skill name does not match its folder");
            return {...skill, folderName: name};
        } catch (error) {
            logger.warn(`Invalid skill folder ${name}:`, error);
            return null;
        }
    }

    static async getAllSkills(): Promise<StoredSkill[]> {
        const skills: StoredSkill[] = [];
        for (const path of await Storage.getFiles(SkillStore.groupName)) {
            const match = /^([^/]+)\/SKILL\.md$/.exec(path);
            if (!match) continue;
            if (!skillNameSchema.safeParse(match[1]).success) {
                logger.warn(`Invalid skill folder name: ${match[1]}`);
                continue;
            }
            const skill = await SkillStore.getSkill(match[1]);
            if (skill) skills.push(skill);
        }
        return skills.sort(
            (left, right) =>
                Number(right.builtInSkill === true) - Number(left.builtInSkill === true) ||
                left.name.localeCompare(right.name)
        );
    }

    static skillExists(name: string): Promise<boolean> {
        return Storage.fileExists(SkillStore.folderGroup(name), "SKILL.md");
    }

    /** List every file recursively, with paths relative to the skill folder. */
    static async listSkillFiles(name: string): Promise<string[]> {
        const paths = await Storage.getFiles(SkillStore.folderGroup(name));
        assertStorageFileTree(paths);
        return paths.sort();
    }

    static async getSkillFiles(name: string): Promise<SkillFolderFiles> {
        const group = SkillStore.folderGroup(name);
        const entries = await Promise.all(
            (await SkillStore.listSkillFiles(name)).map(async (path) => {
                const content = await Storage.getFileContent(group, path);
                if (content === undefined)
                    throw new Error(`Skill file disappeared while reading: ${name}/${path}`);
                return [path, content] as const;
            })
        );
        return Object.fromEntries(entries);
    }

    private static buildFiles(
        content: string,
        options: SaveSkillFileOptions,
        previousFiles: SkillFolderFiles = {}
    ): SkillFolderFiles {
        SkillStore.parseContent(content);
        const files = {...previousFiles};
        files["SKILL.md"] = content;
        for (const category of ["references", "scripts"] as const) {
            const resources = options[category];
            if (resources === undefined) continue;
            if (resources === null || typeof resources !== "object" || Array.isArray(resources)) {
                throw new Error(`Skill ${category} must be a map of relative paths to text`);
            }
            for (const path of Object.keys(files)) {
                if (path.startsWith(`${category}/`)) delete files[path];
            }
            for (const [path, text] of Object.entries(resources)) {
                assertRelativeStoragePath(path);
                if (typeof text !== "string")
                    throw new Error(`Skill resource must contain text: ${path}`);
                files[`${category}/${path}`] = text;
            }
        }
        assertStorageFileTree(Object.keys(files));
        return files;
    }

    private static async writeSnapshot(
        name: string,
        files: SkillFolderFiles,
        removeObsolete = true
    ): Promise<void> {
        assertStorageFileTree(Object.keys(files));
        const previousFiles = await SkillStore.getSkillFiles(name);
        const group = SkillStore.folderGroup(name);
        const paths = Object.keys(files);
        const removedPaths = Object.keys(previousFiles).filter(
            (path) => !Object.hasOwn(files, path)
        );
        // Real sandbox files cannot become directories (or vice versa) until blockers are removed.
        const blockers = removedPaths.filter((oldPath) =>
            paths.some(
                (newPath) => oldPath.startsWith(`${newPath}/`) || newPath.startsWith(`${oldPath}/`)
            )
        );
        for (const path of blockers) await Storage.deleteFile(group, path);
        for (const [path, text] of Object.entries(files)) {
            if (previousFiles[path] !== text) await Storage.saveFile(group, path, text);
        }
        if (removeObsolete) {
            for (const path of removedPaths) {
                if (!blockers.includes(path)) await Storage.deleteFile(group, path);
            }
        }
    }

    private static async applySnapshots(
        desired: Map<string, SkillFolderFiles>,
        originals: Map<string, SkillFolderFiles>,
        failureMessage: string
    ): Promise<void> {
        const touched: string[] = [];
        try {
            for (const [name, files] of desired) {
                if (Object.keys(files).length === 0) continue;
                touched.push(name);
                await SkillStore.writeSnapshot(name, files, false);
            }
            // All destination contents exist before stale files or deleted source folders are removed.
            for (const [name, files] of desired) {
                if (!touched.includes(name)) touched.push(name);
                await SkillStore.writeSnapshot(name, files);
            }
        } catch (error) {
            const rollbackErrors: unknown[] = [];
            for (const name of touched.reverse()) {
                try {
                    await SkillStore.writeSnapshot(name, originals.get(name)!);
                } catch (rollbackError) {
                    rollbackErrors.push(rollbackError);
                }
            }
            if (rollbackErrors.length) {
                logger.error(
                    `Failed to restore skill folders: ${touched.join(", ")}`,
                    rollbackErrors
                );
                throw new AggregateError([error, ...rollbackErrors], failureMessage);
            }
            throw error;
        }
    }

    static saveSkillFile(content: string, options: SaveSkillFileOptions = {}): Promise<void> {
        return SkillStore.serializeMutation(async () => {
            const {name} = SkillStore.parseContent(content);
            const previous = await SkillStore.getSkillFiles(name);
            const files = SkillStore.buildFiles(content, options, previous);
            await SkillStore.applySnapshots(
                new Map([[name, files]]),
                new Map([[name, previous]]),
                `Failed to save and restore skill: ${name}`
            );
        });
    }

    /** Authoritative replacement for bundled skills, including unexpected auxiliary files. */
    static replaceSkillFolder(content: string, options: SaveSkillFileOptions = {}): Promise<void> {
        return SkillStore.serializeMutation(async () => {
            const {name} = SkillStore.parseContent(content);
            const files = SkillStore.buildFiles(content, options);
            const previous = await SkillStore.getSkillFiles(name);
            await SkillStore.applySnapshots(
                new Map([[name, files]]),
                new Map([[name, previous]]),
                `Failed to replace and restore skill: ${name}`
            );
        });
    }

    static async matchesBundledSkill(
        bundled: BundledSkill,
        options?: HashOptions
    ): Promise<boolean> {
        const {name} = SkillStore.parseContent(bundled.content);
        return (
            (await SkillStore.hashSkillFiles(name, options)) ===
            hashSkillFileSnapshot(SkillStore.buildFiles(bundled.content, bundled), options)
        );
    }

    static deleteSkill(name: string): Promise<void> {
        return SkillStore.serializeMutation(async () => {
            const previous = await SkillStore.getSkillFiles(name);
            await SkillStore.applySnapshots(
                new Map([[name, {}]]),
                new Map([[name, previous]]),
                `Failed to delete and restore skill: ${name}`
            );
        });
    }

    /** Save editor identities as one serialized, best-effort rollback batch. */
    static saveEditedSkills(
        entries: readonly EditedSkill[],
        originalNames: readonly string[]
    ): Promise<void> {
        return SkillStore.serializeMutation(async () => {
            const sourceNames = new Set(originalNames.map((name) => skillNameSchema.parse(name)));
            if (sourceNames.size !== originalNames.length)
                throw new Error("Duplicate original skill identity");
            const snapshots = new Map<string, SkillFolderFiles>();
            const sources = new Map<string, StoredSkill>();
            for (const name of sourceNames) {
                const source = await SkillStore.getSkill(name);
                if (!source) throw new Error(`Missing or invalid original skill: ${name}`);
                sources.set(name, source);
                snapshots.set(name, await SkillStore.getSkillFiles(name));
            }
            const desired = new Map<string, SkillFolderFiles>();
            const usedSources = new Set<string>();
            const storedPaths = await Storage.getFiles(SkillStore.groupName);
            for (const entry of entries) {
                const next = SkillStore.parseContent(entry.content);
                const templateIssue = (await validateFrontmatterTemplate(entry.content))[0];
                if (templateIssue) throw new Error(templateIssue.message);
                if (desired.has(next.name)) throw new Error(`Duplicate skill name: ${next.name}`);
                const originalName = entry.originalSkillName;
                let files: SkillFolderFiles = {};
                if (originalName !== undefined) {
                    if (!sourceNames.has(originalName) || usedSources.has(originalName))
                        throw new Error(`Invalid original skill identity: ${originalName}`);
                    usedSources.add(originalName);
                    files = snapshots.get(originalName)!;
                    const source = sources.get(originalName)!;
                    if (source.builtInSkill) {
                        const options = {
                            ignoreDisableModelInvocation:
                                source.builtInSkillUserControllable === true
                        };
                        if (
                            next.name !== originalName ||
                            hashSkillFileSnapshot(files, options) !==
                                hashSkillFileSnapshot(
                                    {...files, "SKILL.md": entry.content},
                                    options
                                )
                        ) {
                            throw new Error(`Built-in skill is read-only: ${originalName}`);
                        }
                    } else if (next.builtInSkill || next.builtInSkillUserControllable) {
                        throw new Error("Editor cannot create built-in skills");
                    }
                } else if (next.builtInSkill || next.builtInSkillUserControllable) {
                    throw new Error("Editor cannot create built-in skills");
                }
                if (!sourceNames.has(next.name)) {
                    if (
                        storedPaths.some(
                            (path) => path === next.name || path.startsWith(`${next.name}/`)
                        )
                    )
                        throw new Error(`Skill destination is occupied: ${next.name}`);
                    snapshots.set(next.name, {});
                }
                const nextFiles = {...files, "SKILL.md": entry.content};
                assertStorageFileTree(Object.keys(nextFiles));
                desired.set(next.name, nextFiles);
            }
            for (const [name, source] of sources) {
                if (source.builtInSkill && !usedSources.has(name))
                    throw new Error(`Built-in skill cannot be deleted: ${name}`);
            }
            // Append deletions only after every destination; swaps retain both identities.
            for (const name of sourceNames) if (!desired.has(name)) desired.set(name, {});
            await SkillStore.applySnapshots(
                desired,
                snapshots,
                `Failed to save and restore skill folders: ${[...desired.keys()].join(", ")}`
            );
        });
    }

    /** Read and hash all persisted files recursively, including arbitrary auxiliary folders. */
    static async hashSkillFiles(name: string, options?: HashOptions): Promise<string> {
        if (!(await SkillStore.getSkill(name)))
            throw new Error(`Missing or invalid skill: ${name}`);
        return hashSkillFileSnapshot(await SkillStore.getSkillFiles(name), options);
    }
}
