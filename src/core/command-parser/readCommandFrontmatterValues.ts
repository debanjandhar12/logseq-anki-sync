import type {CommandInvokeLocation} from "../stores/command-file-store/types";
import {COMMAND_FRONTMATTER_FIELDS, COMMAND_INVOKE_LOCATIONS} from "./constants";
import type {CommandFrontmatterValues} from "./types";

export function readCommandFrontmatterValues(
    data: Record<string, unknown>
): CommandFrontmatterValues {
    const values: CommandFrontmatterValues = {};
    const invokeLocations = new Set<string>(COMMAND_INVOKE_LOCATIONS);

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
                (item): item is CommandInvokeLocation =>
                    typeof item === "string" && invokeLocations.has(item)
            )
        ) {
            Object.assign(values, {[field.dataKey]: [...value]});
        }
    }

    return values;
}
