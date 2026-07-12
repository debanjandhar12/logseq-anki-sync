export const MAX_TITLE_LENGTH = 50;

export const capitalize = (s: string): string =>
    s.length === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1);

export const truncateAtWordBoundary = (s: string, maxLen: number): string => {
    if (s.length <= maxLen) return s;
    const lastSpace = s.lastIndexOf(" ", maxLen);
    return lastSpace > 0 ? s.slice(0, lastSpace) : s.slice(0, maxLen);
};

export const cleanTitle = (s: string): string => capitalize(s.replace(/[?!.,;:]+$/g, "").trim());

export const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
