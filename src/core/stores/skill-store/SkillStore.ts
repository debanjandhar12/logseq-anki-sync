import matter from "gray-matter";
import {createLogger, LoggerCategory} from "../../../logger";
import {LogseqPluginStorageManager as Storage} from "../../../logseq/LogseqPluginStorageManager";
import {
    assertRelativeStoragePath,
    assertStorageFileTree
} from "../../../logseq/LogseqPluginStorageManager/relativeStoragePath";
import {parseSkillFile} from "../../skill-parser/parseSkillFile";
import {skillMetadataSchema, skillNameSchema} from "../../skill-parser/skillMetadataSchema";
import type {SkillFileData} from "../skill-file-store/types";
import {hashSkillFileSnapshot} from "./hashSkillFileSnapshot";
import type {HashOptions, SaveSkillFileOptions, SkillFolderFiles, StoredSkill} from "./types";

const logger = createLogger(LoggerCategory.PLUGIN_STORAGE);

/** Skill folders and their text resources, independent of model/UI policy. */
export class SkillStore {
    static readonly groupName = "skills";

    private static folderGroup(name: string): string {
        return `${SkillStore.groupName}/${skillNameSchema.parse(name)}`;
    }

    private static parseContent(content: string): SkillFileData {
        const parsed = parseSkillFile(content);
        // Validate raw YAML values: the legacy parser intentionally trims strings.
        skillMetadataSchema.parse(matter(content, {}).data);
        return parsed;
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

    static async saveSkillFile(content: string, options: SaveSkillFileOptions = {}): Promise<void> {
        const skill = SkillStore.parseContent(content);
        const previousFiles = await SkillStore.getSkillFiles(skill.name);
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
        const group = SkillStore.folderGroup(skill.name);
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
        try {
            for (const path of blockers) await Storage.deleteFile(group, path);
            for (const [path, text] of Object.entries(files)) {
                if (previousFiles[path] !== text) await Storage.saveFile(group, path, text);
            }
            for (const path of removedPaths) {
                if (!blockers.includes(path)) await Storage.deleteFile(group, path);
            }
        } catch (error) {
            try {
                // Recreate the original tree after removing possible new path-shape conflicts.
                for (const path of await Storage.getFiles(group)) {
                    if (!Object.hasOwn(previousFiles, path)) await Storage.deleteFile(group, path);
                }
                for (const [path, text] of Object.entries(previousFiles))
                    await Storage.saveFile(group, path, text);
            } catch (rollbackError) {
                throw new AggregateError(
                    [error, rollbackError],
                    `Failed to save and restore skill: ${skill.name}`
                );
            }
            throw error;
        }
    }

    static async deleteSkill(name: string): Promise<void> {
        const group = SkillStore.folderGroup(name);
        for (const path of await SkillStore.listSkillFiles(name))
            await Storage.deleteFile(group, path);
    }

    /** Read and hash all persisted files recursively, including arbitrary auxiliary folders. */
    static async hashSkillFiles(name: string, options?: HashOptions): Promise<string> {
        if (!(await SkillStore.getSkill(name)))
            throw new Error(`Missing or invalid skill: ${name}`);
        return hashSkillFileSnapshot(await SkillStore.getSkillFiles(name), options);
    }
}
