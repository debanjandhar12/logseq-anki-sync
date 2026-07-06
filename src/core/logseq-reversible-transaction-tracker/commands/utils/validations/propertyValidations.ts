import {z} from "zod";

export const PropertyUuidOrIndentSchema = z
    .string()
    .min(1)
    .describe("Logseq property page UUID or property indent/key.");

export function validatePropertyUuidOrIndent(propertyUuidOrIndent: string): string {
    return PropertyUuidOrIndentSchema.parse(propertyUuidOrIndent);
}
