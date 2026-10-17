import {parseSkillFile} from "../../../skill-parser/parseSkillFile";
import {hashSkillFileSnapshot} from "../hashSkillFileSnapshot";

export function validateSkillMutation(
    originalSource: string | undefined,
    nextSource: string | undefined
): string | null {
    const original = originalSource === undefined ? undefined : parseSkillFile(originalSource);
    const next = nextSource === undefined ? undefined : parseSkillFile(nextSource);
    if (!original?.builtInSkill) {
        return next?.builtInSkill || next?.builtInSkillUserControllable
            ? "Editor cannot create built-in skills"
            : null;
    }
    if (!next) return `Built-in skill cannot be deleted: ${original.name}`;
    const options = {ignoreDisableModelInvocation: original.builtInSkillUserControllable === true};
    return next.name === original.name &&
        hashSkillFileSnapshot({"SKILL.md": originalSource!}, options) ===
            hashSkillFileSnapshot({"SKILL.md": nextSource!}, options)
        ? null
        : `Built-in skill is read-only: ${original.name}`;
}
