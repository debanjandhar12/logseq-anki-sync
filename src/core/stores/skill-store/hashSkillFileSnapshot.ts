import {sha256} from "@noble/hashes/sha2.js";
import {bytesToHex, utf8ToBytes} from "@noble/hashes/utils.js";
import matter from "gray-matter";
import {assertStorageFileTree} from "../../../logseq/LogseqPluginStorageManager/relativeStoragePath";
import {SKILL_FRONTMATTER_KEYS} from "../../skill-parser/constants";
import type {HashOptions, SkillFolderFiles} from "./types";

const HASH_FORMAT_VERSION = "skill-files-v1";

function sortMetadata(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(sortMetadata);
    if (value && Object.getPrototypeOf(value) === Object.prototype) {
        return Object.fromEntries(
            Object.entries(value)
                .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
                .map(([key, item]) => [key, sortMetadata(item)])
        );
    }
    return value;
}

function sha256Hex(value: string): string {
    return bytesToHex(sha256(utf8ToBytes(value)));
}

export function hashSkillFileSnapshot(files: SkillFolderFiles, options: HashOptions = {}): string {
    assertStorageFileTree(Object.keys(files));
    if (typeof files["SKILL.md"] !== "string") throw new Error("Skill folder is missing SKILL.md");
    let skillFileContent = files["SKILL.md"];
    if (options.ignoreDisableModelInvocation) {
        const parsed = matter(skillFileContent, {});
        const metadata = {...parsed.data};
        delete metadata[SKILL_FRONTMATTER_KEYS.disableModelInvocation];
        skillFileContent = matter.stringify(
            parsed.content,
            sortMetadata(metadata) as Record<string, unknown>
        );
    }

    const resourceEntries = Object.keys(files)
        .filter((path) => path !== "SKILL.md")
        .sort()
        .map((path) => {
            const content = files[path];
            if (typeof content !== "string")
                throw new Error(`Skill file must contain text: ${path}`);
            return [path, content];
        });

    const skillFileHash = sha256Hex(skillFileContent);
    const resourceHash = sha256Hex(JSON.stringify(resourceEntries));
    return sha256Hex(JSON.stringify([HASH_FORMAT_VERSION, skillFileHash, resourceHash]));
}
