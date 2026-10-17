import {commandNameSchema as commandFormatNameSchema} from "../../../command-parser/commandNameSchema";
import {commandFileNameSchema} from "./validateCommandFileName";

/** Format identity composed with storage policy; use for transaction arguments. */
export const storageSafeCommandNameSchema = commandFormatNameSchema.refine(
    (name) => commandFileNameSchema.safeParse(`${name}.md`).success,
    "Command name must be a valid simple name, not a path"
);

/** Compatibility alias: this remains storage-safe, not the parser's format-only schema. */
export const commandNameSchema = storageSafeCommandNameSchema;
