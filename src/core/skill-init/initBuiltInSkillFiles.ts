import QUERY_FIND_ORIGINAL_PAGE_FROM_ALIAS_RAW from "src/chat-app/prompts/skills/logseq-datascript-queries/examples/FIND_ORIGINAL_PAGE_FROM_ALIAS.ds?raw";
import SKILL_LOGSEQ_DATASCRIPT_QUERIES_RAW from "../../chat-app/prompts/skills/logseq-datascript-queries/SKILL.md?inlineSkill";
import SKILL_LOGSEQ_DATASCRIPT_QUERY_PITFALLS_RAW from "../../chat-app/prompts/skills/logseq-datascript-query-pitfalls/SKILL.md?inlineSkill";
import SKILL_LOGSEQ_PROPERTIES_AND_TAGS_RAW from "../../chat-app/prompts/skills/logseq-properties-and-tags/SKILL.md?inlineSkill";
import SKILL_LOGSEQ_TOOLS_GUIDE_RAW from "../../chat-app/prompts/skills/logseq-tools-guide/SKILL.md?inlineSkill";
import SKILL_LOGSEQ_VIDEO_AND_WEB_EMBEDS_RAW from "../../chat-app/prompts/skills/logseq-video-and-web-embeds/SKILL.md?inlineSkill";
import SKILL_CREATOR_RAW from "../../chat-app/prompts/skills/skill-creator/SKILL.md?inlineSkill";
import SKILL_WORKING_WITH_BASH_RAW from "../../chat-app/prompts/skills/working-with-bash/SKILL.md?inlineSkill";
import {parseSkillFile} from "../skill-parser";
import {SkillStore} from "../stores/skill-store/SkillStore";
import type {BundledSkill} from "../stores/skill-store/types";

const BUILT_IN_SKILLS: BundledSkill[] = [
    {
        content: SKILL_LOGSEQ_DATASCRIPT_QUERIES_RAW,
        examples: {
            "FIND_ORIGINAL_PAGE_FROM_ALIAS.ds": QUERY_FIND_ORIGINAL_PAGE_FROM_ALIAS_RAW
        }
    },
    ...[
        SKILL_LOGSEQ_TOOLS_GUIDE_RAW,
        SKILL_LOGSEQ_PROPERTIES_AND_TAGS_RAW,
        SKILL_LOGSEQ_DATASCRIPT_QUERY_PITFALLS_RAW,
        SKILL_LOGSEQ_VIDEO_AND_WEB_EMBEDS_RAW,
        SKILL_WORKING_WITH_BASH_RAW,
        SKILL_CREATOR_RAW
    ].map((content) => ({
        content,
        references: {},
        scripts: {}
    }))
];

export const initBuiltInSkillFiles = async () => {
    const bundledNames = new Set(BUILT_IN_SKILLS.map(({content}) => parseSkillFile(content).name));
    for (const existing of await SkillStore.getAllSkills()) {
        if (existing.builtInSkill && !bundledNames.has(existing.folderName)) {
            await SkillStore.deleteSkill(existing.folderName);
        }
    }
    for (const bundled of BUILT_IN_SKILLS) {
        const name = parseSkillFile(bundled.content).name;
        const exists = await SkillStore.skillExists(name);
        const existing = await SkillStore.getSkill(name);
        if (exists && !existing) continue;
        if (existing && !existing.builtInSkill) continue;
        if (
            existing &&
            (await SkillStore.matchesBundledSkill(bundled, {ignoreDisableModelInvocation: true}))
        )
            continue;
        await SkillStore.replaceSkillFolder(bundled.content, bundled);
    }
};
