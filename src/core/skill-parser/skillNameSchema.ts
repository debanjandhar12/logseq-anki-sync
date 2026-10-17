import {z} from "zod";

export const skillNameSchema = z
    .string()
    .min(1)
    .max(64)
    .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        "Skill name must contain lowercase letters, digits, and single separating hyphens"
    );
