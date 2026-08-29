import type {CommandInvokeCondition} from "../stores/command-file-store/types";
import {COMMAND_FRONTMATTER_FIELDS, COMMAND_INVOKE_CONDITIONS} from "./constants";
import type {CommandFrontmatterValues} from "./types";

export function readCommandFrontmatterValues(
    data: Record<string, unknown>
): CommandFrontmatterValues {
    const values: CommandFrontmatterValues = {};
    const invokeConditions = new Set<string>(COMMAND_INVOKE_CONDITIONS);

    for (const field of COMMAND_FRONTMATTER_FIELDS) {
        const value = data[field.key];
        if (field.valueType === "string" && typeof value === "string") {
            Object.assign(values, {[field.dataKey]: value.trim()});
        } else if (field.valueType === "boolean" && typeof value === "boolean") {
            Object.assign(values, {[field.dataKey]: value});
        } else if (
            field.valueType === "string-array" &&
            Array.isArray(value) &&
            value.every(
                (item): item is CommandInvokeCondition =>
                    typeof item === "string" && invokeConditions.has(item)
            )
        ) {
            Object.assign(values, {[field.dataKey]: [...value]});
        }
    }

    return values;
}
