import SKILL_LOGSEQ_QUERY_RAW from "../../chat-app/prompts/SKILL_LOGSEQ_DATASCRIPT_QUERY.md?raw";
import SKILL_LOGSEQ_DATASCRIPT_QUERY_PITFALLS_RAW from "../../chat-app/prompts/SKILL_LOGSEQ_DATASCRIPT_QUERY_PITFALLS.md?raw";
import SKILL_LOGSEQ_DSL_QUERY_RAW from "../../chat-app/prompts/SKILL_LOGSEQ_DSL_QUERY.md?raw";
import SKILL_LOGSEQ_PROPERTIES_RAW from "../../chat-app/prompts/SKILL_LOGSEQ_PROPERTIES.md?raw";
import {SkillFileStore} from "../stores/skill-file-store/SkillFileStore";

const DEFAULT_SKILL_FILES = [
    SKILL_LOGSEQ_QUERY_RAW,
    SKILL_LOGSEQ_DSL_QUERY_RAW,
    SKILL_LOGSEQ_PROPERTIES_RAW,
    SKILL_LOGSEQ_DATASCRIPT_QUERY_PITFALLS_RAW
];

export const initDefaultInstalledSkillFiles = async () => {
    const defaultSkillFileNames = new Set(
        DEFAULT_SKILL_FILES.map((raw) => SkillFileStore.getSkillFileNameFromContent(raw))
    );

    // Delete existing skills that default installed and not in DEFAULT_SKILL_FILES
    const existingSkillFiles = await SkillFileStore.getAllSkillFile();

    for (const existingSkillFile of existingSkillFiles) {
        const existingFileName = SkillFileStore.getSkillFileName(existingSkillFile);

        if (
            existingSkillFile.defaultInstalledSkill &&
            !defaultSkillFileNames.has(existingFileName)
        ) {
            await SkillFileStore.deleteSkillFile(existingFileName);
        }
    }

    // Create / upsert default installed skills
    for (const raw of DEFAULT_SKILL_FILES) {
        const fileName = SkillFileStore.getSkillFileNameFromContent(raw);
        const existing = await SkillFileStore.getSkillFile(fileName);

        if (existing && !existing.defaultInstalledSkill) {
            continue;
        }

        await SkillFileStore.saveSkillFile(raw);
    }
};
