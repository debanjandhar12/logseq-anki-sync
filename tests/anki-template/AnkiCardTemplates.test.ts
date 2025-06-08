import { describe, expect, test, beforeAll } from 'vitest';
import {
    getTemplateMediaFiles
} from '../../src/anki-template/AnkiCardTemplates';

describe('Anki Card Templates JavaScript Build Tests', () => {
    let templateMediaFiles: ReturnType<typeof getTemplateMediaFiles>;

    beforeAll(() => {
        templateMediaFiles = getTemplateMediaFiles();
    });

    describe('_logseq_anki_sync_front.js (Front Side JavaScript)', () => {
        let jsContent: string;

        beforeAll(() => {
            jsContent = templateMediaFiles['_logseq_anki_sync_front.js'];
        });

        test('should be valid JavaScript (no syntax errors)', () => {
            expect(() => {
                new Function(jsContent);
            }).not.toThrow();
        });

        test('should contain compiled code from fabric.js', () => {
            expect(jsContent).toMatch(/fabric\.js/i);
        });
    });

    describe('_logseq_anki_sync_back.js (Back Side JavaScript)', () => {
        let jsContent: string;

        beforeAll(() => {
            jsContent = templateMediaFiles['_logseq_anki_sync_back.js'];
        });

        test('should be valid JavaScript (no syntax errors)', () => {
            expect(() => {
                new Function(jsContent);
            }).not.toThrow();
        });
    });

    describe('_logseq_anki_sync.js (Both Side JavaScript)', () => {
        let jsContent: string;

        beforeAll(() => {
            jsContent = templateMediaFiles['_logseq_anki_sync.js'];
        });

        test('should be valid JavaScript (no syntax errors)', () => {
            expect(() => {
                new Function(jsContent);
            }).not.toThrow();
        });
    });
});