const JOURNAL_PAGE_NAME_PATTERN = /^([a-z]{3}) ([1-9]|[12]\d|3[01])(st|nd|rd|th), (\d{4})$/i;

const MONTH_INDEXES = new Map([
    ["jan", 0],
    ["feb", 1],
    ["mar", 2],
    ["apr", 3],
    ["may", 4],
    ["jun", 5],
    ["jul", 6],
    ["aug", 7],
    ["sep", 8],
    ["oct", 9],
    ["nov", 10],
    ["dec", 11]
]);

function getOrdinalSuffix(day: number): string {
    const lastTwoDigits = day % 100;
    if (lastTwoDigits >= 11 && lastTwoDigits <= 13) return "th";

    switch (day % 10) {
        case 1:
            return "st";
        case 2:
            return "nd";
        case 3:
            return "rd";
        default:
            return "th";
    }
}

export function getJournalDateFromPageName(pageName: string): Date | null {
    const match = JOURNAL_PAGE_NAME_PATTERN.exec(pageName);
    if (!match) return null;

    const [, monthName, dayText, ordinalSuffix, yearText] = match;
    const monthIndex = MONTH_INDEXES.get(monthName.toLowerCase());
    const day = Number(dayText);
    const year = Number(yearText);
    if (
        monthIndex === undefined ||
        year < 1000 ||
        ordinalSuffix.toLowerCase() !== getOrdinalSuffix(day)
    ) {
        return null;
    }

    const date = new Date(0);
    date.setHours(12, 0, 0, 0);
    date.setFullYear(year, monthIndex, day);
    if (date.getFullYear() !== year || date.getMonth() !== monthIndex || date.getDate() !== day) {
        return null;
    }

    return date;
}

export function isJournalPageName(pageName: string): boolean {
    return getJournalDateFromPageName(pageName) !== null;
}
