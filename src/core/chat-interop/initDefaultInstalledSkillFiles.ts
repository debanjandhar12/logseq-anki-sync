import SKILL_LOGSEQ_QUERY_RAW from "../../chat-app/prompts/SKILL_LOGSEQ_DATASCRIPT_QUERY.md?raw";
import {SkillFileStore} from "../stores/skill-file-store/SkillFileStore";

const DEFAULT_SKILL_FILES = [{fileName: "Logseq Query.md", raw: SKILL_LOGSEQ_QUERY_RAW}];

/**
 * This upserts a few default skill files.
 * Only saves if the skill doesn't exist yet or was previously default-installed.
 */
export const initDefaultInstalledSkillFiles = async () => {
    for (const {fileName, raw} of DEFAULT_SKILL_FILES) {
        const existing = await SkillFileStore.getSkillFile(fileName);

        if (existing && !existing.defaultInstalledSkill) {
            continue;
        }

        await SkillFileStore.saveSkillFile(fileName, raw);
    }
};
