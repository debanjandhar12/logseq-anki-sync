import type {SkillFileData} from "src/core/stores/skill-file-store/types";

export function getSkillFileName(skillFileData: Pick<SkillFileData, "name">): string {
    return `${skillFileData.name}.md`;
}
