import {z} from "zod";

export const skillNameSchema = z
    .string()
    .min(1)
    .max(64)
    .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        "Skill name must contain lowercase letters, digits, and single separating hyphens"
    );

export const skillDescriptionSchema = z
    .string()
    .max(1024)
    .refine((value) => value.trim().length > 0, "Skill description must not be empty");

export const skillMetadataSchema = z.object({
    name: skillNameSchema,
    description: skillDescriptionSchema
});
