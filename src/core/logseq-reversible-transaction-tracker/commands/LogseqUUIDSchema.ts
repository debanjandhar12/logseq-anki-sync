import {z} from "zod";

const LOGSEQ_UUID_PATTERN =
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export const LogseqUUIDSchema = z.string().regex(LOGSEQ_UUID_PATTERN, "Invalid Logseq UUID");
