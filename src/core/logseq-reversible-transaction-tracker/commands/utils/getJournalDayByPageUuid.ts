import {LogseqUUIDSchema} from "../LogseqUUIDSchema";

const JOURNAL_DAY_BY_PAGE_UUID_QUERY = `[:find ?journal-day
 :in $ ?page-uuid
 :where
 [?page :block/uuid ?page-uuid]
 [?page :block/journal-day ?journal-day]]`;

export async function getJournalDayByPageUuid(pageUuid: string): Promise<number | null> {
    const validatedPageUuid = LogseqUUIDSchema.parse(pageUuid);
    const result: unknown = await logseq.DB.datascriptQuery(
        JOURNAL_DAY_BY_PAGE_UUID_QUERY,
        `#uuid "${validatedPageUuid}"`
    );

    if (!Array.isArray(result) || result.length > 1) {
        throw new Error("Invalid journal page query result");
    }
    if (result.length === 0) return null;

    const row = result[0];
    if (!Array.isArray(row) || row.length !== 1 || !Number.isInteger(row[0])) {
        throw new Error("Invalid journal page query result");
    }

    return row[0] as number;
}
