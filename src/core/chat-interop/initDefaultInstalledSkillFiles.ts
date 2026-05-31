import SKILL_LOGSEQ_QUERY_RAW from "../../chat-app/prompts/SKILL_LOGSEQ_QUERY.md?raw";
import {parseSkillFile} from "../skill-parser/parseSkillFile";
import {SkillFileStore} from "../stores/skill-file-store/SkillFileStore";

const DEFAULT_SKILL_FILES = [{raw: SKILL_LOGSEQ_QUERY_RAW}];

/**
 * This upserts a few default skill files.
 * Only saves if the skill doesn't exist yet or was previously default-installed.
 */
export const initDefaultInstalledSkillFiles = async () => {
    for (const {raw} of DEFAULT_SKILL_FILES) {
        const parsed = parseSkillFile(raw);
        const existing = await SkillFileStore.getSkillFile(`${parsed.name}.md`);

        if (existing && !existing.defaultInstalledSkill) {
            continue;
        }

        await SkillFileStore.saveSkillFile(`${parsed.name}.md`, {
            ...parsed,
            defaultInstalledSkill: true
        });
    }
};
