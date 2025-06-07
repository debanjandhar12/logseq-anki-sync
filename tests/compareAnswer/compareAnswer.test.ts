import {describe, expect, test} from "vitest";

import { compareAnswer } from '../../src/anki-template/compareAnswer.js';

describe("compareAnswer basic tests", () => {
    test('completely correct input', async () => {
        const expected = '123'
        const provided = '123'
        const result = compareAnswer(expected, provided);

        expect(result).toEqual('<code id="typeans"><span class="typeGood">123</span></code>')
    });
    test('completely incorrect input', async () => {
        const expected = '123'
        const provided = '456'
        const result = compareAnswer(expected, provided);

        expect(result).toEqual('<code id="typeans"><span class="typeBad">456</span><br><span id="typearrow">&darr;</span><br><span class="typeMissed">123</span></code>')
    });
    test('partially correct input', async () => {
        const expected = '123'
        const provided = '1123'
        const result = compareAnswer(expected, provided);

        expect(result).toEqual('<code id="typeans"><span class="typeBad">1</span><span class="typeGood">123</span><br><span id="typearrow">&darr;</span><br><span class="typeGood">123</span></code>')
    });
    test('empty input', async () => {
        const expected = '123'
        const provided = ''
        const result = compareAnswer(expected, provided);

        expect(result).toEqual('<code id="typeans">123</code>')
    });
    test('empty expected', async () => {
        const expected = ''
        const provided = '123'
        const result = compareAnswer(expected, provided);

        expect(result).toEqual('<code id="typeans"><span class="typeBad">123</span><br><span id="typearrow">&darr;</span><br></code>')
    });
    test('white space is trimmed', async () => {
        const expected = ' 123'
        const provided = '123 '
        const result = compareAnswer(expected, provided);

        expect(result).toEqual('<code id="typeans"><span class="typeGood">123</span></code>')
    });
});

describe("compareAnswer unicode tests", () => {
    test('tokenization test', async () => {
        const expected = "¿Y ahora qué vamos a hacer?";
        const provided = "y ahora qe vamosa hacer";
        const result = compareAnswer(expected, provided);

        expect(result).toEqual('<code id="typeans"><span class="typeBad">y</span><span class="typeGood"> ahora q</span><span class="typeBad">e</span><span class="typeGood"> vamos</span><span class="typeMissed">-</span><span class="typeGood">a hacer</span><span class="typeMissed">-</span><br><span id="typearrow">&darr;</span><br><span class="typeMissed">¿Y</span><span class="typeGood"> ahora q</span><span class="typeMissed">ué</span><span class="typeGood"> vamos</span><span class="typeMissed"> </span><span class="typeGood">a hacer</span><span class="typeMissed">?</span></code>');
    });
    test('tokenization test with Russian characters', async () => {
        const expected = "нос";
        const provided = "нс";
        const result = compareAnswer(expected, provided);

        expect(result).toEqual('<code id="typeans"><span class="typeGood">н</span><span class="typeMissed">-</span><span class="typeGood">с</span><br><span id="typearrow">&darr;</span><br><span class="typeGood">н</span><span class="typeMissed">о</span><span class="typeGood">с</span></code>');
    });
    test('tokenization test with Korean characters', async () => {
        const expected = "쓰다듬다";
        const provided = "스다뜸다";
        const result = compareAnswer(expected, provided);

        expect(result).toEqual('<code id="typeans"><span class="typeBad">스</span><span class="typeGood">다</span><span class="typeBad">뜸</span><span class="typeGood">다</span><br><span id="typearrow">&darr;</span><br><span class="typeMissed">쓰</span><span class="typeGood">다</span><span class="typeMissed">듬</span><span class="typeGood">다</span></code>');
    });
});