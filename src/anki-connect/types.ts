/**
 * Type definitions for Anki Connect operations
 */

export interface AnkiNoteFields {
    'uuid-type': string;
    uuid: string;
    Text: string;
    Extra: string;
    Breadcrumb: string;
    Config: string;
}

export interface AnkiNoteFieldValue {
    value: string;
    order: number;
}

export interface AnkiNoteInfo {
    noteId: number;
    cards: number[];
    fields: {
        [K in keyof AnkiNoteFields]: AnkiNoteFieldValue;
    };
    tags: string[];
    deck: string;
}

export interface AnkiAction {
    action: string;
    params: Record<string, any>;
}

export interface AnkiIdUuidPair {
    'uuid-type': string;
    ankiId: number;
}

export interface AnkiOperationError {
    'uuid-type'?: string;
    ankiId?: number;
    error?: Error;
}

export interface AddNotesResult {
    ankiIdUUIDPairs: AnkiIdUuidPair[];
    subOperationResults: AnkiOperationError[];
}

export interface UpdateNotesResult {
    results: AnkiOperationError[];
}

export interface DeleteNotesResult {
    results: AnkiOperationError[];
}

export type OperationType = 'addNotes' | 'updateNotes' | 'deleteNotes' | 'storeAssets';
