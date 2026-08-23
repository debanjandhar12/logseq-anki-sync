import matter from "gray-matter";
import SKILL_LOGSEQ_QUERY_RAW from "../../chat-app/prompts/SKILL_LOGSEQ_DATASCRIPT_QUERY.md?inlineSkill";
import SKILL_LOGSEQ_DATASCRIPT_QUERY_PITFALLS_RAW from "../../chat-app/prompts/SKILL_LOGSEQ_DATASCRIPT_QUERY_PITFALLS.md?inlineSkill";
import SKILL_LOGSEQ_PROPERTIES_RAW from "../../chat-app/prompts/SKILL_LOGSEQ_PROPERTIES_AND_TAGS.md?inlineSkill";
import SKILL_LOGSEQ_TOOLS_GUIDE_RAW from "../../chat-app/prompts/SKILL_LOGSEQ_TOOLS_GUIDE.md?inlineSkill";
import SKILL_LOGSEQ_VIDEO_AND_WEB_EMBEDS_RAW from "../../chat-app/prompts/SKILL_LOGSEQ_WORKING_WITH_VIDEO_AND_WEB_EMBEDS.md?inlineSkill";
import SKILL_CREATOR_RAW from "../../chat-app/prompts/SKILL_SKILL_CREATOR.md?inlineSkill";
import {SkillFileStore} from "../stores/skill-file-store/SkillFileStore";

const BUILT_IN_SKILL_FILES = [
    SKILL_LOGSEQ_QUERY_RAW,
    SKILL_LOGSEQ_TOOLS_GUIDE_RAW,
    SKILL_LOGSEQ_PROPERTIES_RAW,
    SKILL_LOGSEQ_DATASCRIPT_QUERY_PITFALLS_RAW,
    SKILL_LOGSEQ_VIDEO_AND_WEB_EMBEDS_RAW,
    SKILL_CREATOR_RAW
];

export const initBuiltInSkillFiles = async () => {
    const builtInSkillFileNames = new Set(
        BUILT_IN_SKILL_FILES.map((raw) => SkillFileStore.getSkillFileNameFromContent(raw))
    );

    // Remove built-in skills that are no longer bundled with the plugin.
    const existingSkillFiles = await SkillFileStore.getAllSkillFile();

    for (const existingSkillFile of existingSkillFiles) {
        const existingFileName = SkillFileStore.getSkillFileName(existingSkillFile);

        if (existingSkillFile.builtInSkill && !builtInSkillFileNames.has(existingFileName)) {
            await SkillFileStore.deleteSkillFile(existingFileName);
        }
    }

    for (const raw of BUILT_IN_SKILL_FILES) {
        const fileName = SkillFileStore.getSkillFileNameFromContent(raw);
        const existing = await SkillFileStore.getSkillFile(fileName);

        if (existing && !existing.builtInSkill) {
            continue;
        }

        // if file content has not change (ignoring disable-model-invocation), skip overwrite
        if (
            existing &&
            getComparableSkillContent(existing.content) === getComparableSkillContent(raw)
        ) {
            continue;
        }

        await SkillFileStore.saveSkillFile(raw);
    }
};

function getComparableSkillContent(content: string): string {
    const parsed = matter(content);
    const metadata = {...parsed.data};
    delete metadata["disable-model-invocation"];
    return matter.stringify(parsed.content, metadata);
}
