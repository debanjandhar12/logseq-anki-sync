import {describe, expect, test} from "vitest";
import {
    getJournalDateFromPageName,
    isJournalPageName
} from "../../../../../../src/core/logseq-reversible-transaction-tracker/commands/utils/isJournalPageName";

describe("isJournalPageName", () => {
    test.each([
        "jan 1st, 2026",
        "FEB 2ND, 2026",
        "Mar 3rd, 2026",
        "Apr 4th, 2026",
        "May 11th, 2026",
        "Jun 12th, 2026",
        "Jul 13th, 2026",
        "aug 21st, 2026",
        "Aug 22nd, 2026",
        "AUG 23RD, 2026",
        "Sep 30th, 2026",
        "Oct 31st, 2026",
        "Feb 29th, 2000",
        "Feb 29th, 2024"
    ])("recognizes %s", (pageName) => {
        expect(isJournalPageName(pageName)).toBe(true);
    });

    test.each([
        "Jan 1th, 2026",
        "Jan 2th, 2026",
        "Jan 3th, 2026",
        "Jan 11st, 2026",
        "Jan 12nd, 2026",
        "Jan 13rd, 2026",
        "Jan 21th, 2026",
        "Jan 22th, 2026",
        "Jan 23th, 2026",
        "Feb 29th, 1900",
        "Feb 29th, 2025",
        "Feb 30th, 2026",
        "Apr 31st, 2026",
        "Jun 31st, 2026",
        "Sep 31st, 2026",
        "Nov 31st, 2026",
        "January 1st, 2026",
        "Sept 1st, 2026",
        "Jan 01st, 2026",
        "Jan 0th, 2026",
        "Jan 32nd, 2026",
        "Jan 1st 2026",
        "Jan 1st,2026",
        " Jan 1st, 2026",
        "Jan 1st, 2026 ",
        "Jan 1, 2026",
        "Jan 1st, 999",
        "Jan 1st, 0000"
    ])("rejects %s", (pageName) => {
        expect(isJournalPageName(pageName)).toBe(false);
        expect(getJournalDateFromPageName(pageName)).toBeNull();
    });

    test("returns the represented local calendar date", () => {
        const date = getJournalDateFromPageName("AUG 22ND, 2026");

        expect(date).not.toBeNull();
        expect(date?.getFullYear()).toBe(2026);
        expect(date?.getMonth()).toBe(7);
        expect(date?.getDate()).toBe(22);
    });
});
