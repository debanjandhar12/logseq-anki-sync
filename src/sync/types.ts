/**
 * Type definitions for sync operations
 */

/**
 * Represents parsed note data before conversion to Anki note fields.
 * This is the intermediate format returned by parseNote() and used in hash calculation.
 * 
 * Tuple structure:
 * [html, assets, deck, breadcrumb, tags, extra]
 */
export type ParsedNoteData = [
    html: string,
    assets: Set<string>,
    deck: string,
    breadcrumb: string,
    tags: string[],
    extra: string
];
