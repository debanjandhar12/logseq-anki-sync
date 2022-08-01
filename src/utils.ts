import ohm from 'ohm-js';
import _ from 'lodash';
import replaceAsync from "string-replace-async";
import '@logseq/libs';
import { MD_MATH_BLOCK_REGEXP } from './constants';

export function regexPraser(input: string): RegExp {
    if (typeof input !== "string") {
        throw new Error("Invalid input. Input must be a string");
    }
    // Parse input
    var m = input.match(/(\/)(.+)\1([a-z]*)/i);
    // Invalid input (input not in format /regex/i)
    if (m == null) throw "Input string is not in required format for conversion to regex.";
    // Invalid flags
    if (m[3] && !/^(?!.*?(.).*?\1)[gmixXsuUAJ]+$/.test(m[3])) {
        return RegExp(input);
    }
    // Create the regular expression
    return new RegExp(m[2], m[3]);
}

export function string_to_arr(str: string): any {
    let r = [];

    // Define and match the grammer
    const grammer = ohm.grammar(String.raw`
    StrRegArray {
        Exp = listOf<StrOrRegex, separator> separator*
        separator = (whitespace)* "," (whitespace)*
        StrOrRegex = (Regex | Str | "")
        Str = "\'" seqStr "\'"
        Regex =  "/" seqReg "/" (letter|lineTerminator)*
        seqReg = (("\\/" |"\\\\"|~("/")  any))+
        seqStr = (("\\\\"|"\\'"| ~("\'")  any))*
            
        // External rules
        whitespace = "\t"
                   | "\x0B"    -- verticalTab
                   | "\x0C"    -- formFeed
                   | " "
                   | "\u00A0"  -- noBreakSpace
                   | "\uFEFF"  -- byteOrderMark
                   | unicodeSpaceSeparator
         unicodeSpaceSeparator = "\u2000".."\u200B" | "\u3000"
         lineTerminator = "\n" | "\r" | "\u2028" | "\u2029"
      }`);
    let matchResult = grammer.match(str);
    if (matchResult.failed()) { throw "Cannot parse array list from string"; return r; }

    // Define and assciate semantic actions with grammar
    const actions = {
        Exp(a, b) { a.semanticOperation(); b.semanticOperation(); },
        nonemptyListOf(a, b, c) { a.semanticOperation(); c.semanticOperation(); },
        emptyListOf() { },
        _iter(...a) { for (let b of a) b.semanticOperation(); },
        separator(a, b, c) { },
        StrOrRegex(a) { a.semanticOperation(); },
        _terminal() { },
        Regex(a, b, c, d) { r.push(regexPraser(this.sourceString)) },
        Str(a, b, c) { r.push(this.children[1].sourceString) },
    }
    const s = grammer.createSemantics();
    s.addOperation('semanticOperation', actions);
    s(matchResult).semanticOperation();
    return r;
}

export function decodeHTMLEntities(text, exclude = ["gt", "lt"]) {
    var entities = [
        ['amp', '&'],
        ['apos', '\''],
        ['#x27', '\''],
        ['#x2F', '/'],
        ['#39', '\''],
        ['#47', '/'],
        ['lt', '<'],
        ['gt', '>'],
        ['nbsp', ' '],
        ['quot', '"']
    ];
    entities = entities.filter(e => !exclude.includes(e[0]));

    for (var i = 0, max = entities.length; i < max; ++i)
        text = text.replace(new RegExp('&' + entities[i][0] + ';', 'g'), entities[i][1]);

    return text;
}


export function get_math_inside_md(res: string): Array<string> {
    let res2 = res;
    let arr = [];
    res2 = res2.replace(MD_MATH_BLOCK_REGEXP, (match) => {
        arr.push(match);
        return "\\( $1 \\)"
    });
    res2 = res2.replace(/(?<!\$)\$((?=[\S])(?=[^$])[\S \t\r]*?)\$/g, (match) => {
        arr.push(match);
        return "\\( $1 \\)"
    });
    return arr;
}

export function get_better_error_msg(msg: string): string {
    switch (msg) {
        case "failed to issue request":
            return "Please ensure Anki is open in background with AnkiConnect installed properly. See installation instruction for more information.";
        case "Permission to access anki was denied":
            return "Please give permission to access anki by clicking Yes when promted.";
        case "collection is not available":
            return "Please select an Anki Profile before syncing.";
    }
    return msg;
}

export function getRandomUnicodeString(length?: number): string {
    var chars = "\u2ddf\u22b3\u22b0\u278c\u23a1\u230f\u245d\u25da\u2efa\u2b79\u2b4d\u24e8\u2b8e\u2be4\u22cb\u2fed\u2063\u27c9\u24cf\u2904\u24a3\u24d0\u25e7\u22b5\u21da\u20ce\u2435\u2686\u2ba6\u27af\u244e\u23be\u298a\u26b0\u29ec\u2351\u234c\u2e7c\u2236\u243c\u2756\u21bf\u232b\u2936\u2b11\u2798\u20fe";
    return _.sampleSize(chars, length || 12).join("");
}

export function getFirstNonEmptyLine(str: string): string {
    let start = 0, end;
    let current_line_empty = true;
    for(end = 0; end < str.length; end++) {
        if (str[end] != " " && str[end] != "\t" && str[end] != "\n")
            current_line_empty = false;
        if (str[end] == "\n") {
            if (!current_line_empty) return str.substring(start, end);
            else {
                start = end + 1;
                current_line_empty = true;
            }
        }
    }
    return str.substring(start);
}


// Replace function that avoids replacing inside math and code blocks
export function safeReplace(content: string, regex: RegExp | string, replaceArg: any): string {
    let result = content;
    let hashmap = {};
    result = result.replace(MD_MATH_BLOCK_REGEXP, (match) => { // Escape block math
        let str = getRandomUnicodeString();
        hashmap[str] = match.replaceAll("$", "$$$$");
        return str;
    });
    result = result.replace(/(?<!\$)\$((?=[\S])(?=[^$])[\S \t\r]*?)\$/g, (match: string) => { // Escape inline math
        let str = getRandomUnicodeString();
        hashmap[str] = match.replaceAll("$", "$$$$");
        return str;
    });
    result = result.replace(/```(.*)\n(.|\n)*?\n```/g, (match) => { // Escape code
        let str = getRandomUnicodeString();
        hashmap[str] = match;
        return str;
    });
    result = result.replace(regex, replaceArg);
    for (let key in hashmap) {
        result = result.replace(key, hashmap[key]);
    }
    return result;
}

export async function safeReplaceAsync(content: string, regex: RegExp | string, replaceArg: any): Promise<string> {
    let result = content;
    let hashmap = {};
    result = result.replace(MD_MATH_BLOCK_REGEXP, (match) => { // Escape block math
        let str = getRandomUnicodeString();
        hashmap[str] = match.replaceAll("$", "$$$$");
        return str;
    });
    result = result.replace(/(?<!\$)\$((?=[\S])(?=[^$])[\S \t\r]*?)\$/g, (match: string) => { // Escape inline math
        let str = getRandomUnicodeString();
        hashmap[str] = match.replaceAll("$", "$$$$");
        return str;
    });
    result = result.replace(/```(.*)\n(.|\n)*?\n```/g, (match) => { // Escape code
        let str = getRandomUnicodeString();
        hashmap[str] = match;
        return str;
    });
    result = await replaceAsync(result, regex, replaceArg);
    for (let key in hashmap) {
        result = result.replace(key, hashmap[key]);
    }
    return result;
}

export async function sortAsync<T>(arr: T[], score: (a: T) => Promise<number>): Promise<T[]> {
    let toSortPromises = arr.map(
        async (item) => {
            return {
                item: item,
                score: await score(item)
            }
        }
    );
    return await Promise.all(toSortPromises).then( toSort => {
        console.log(toSort);
        return toSort.sort((a, b) => {
            return a.score - b.score;
        }).map(x => x.item);
    });
}

export async function confirm(msg: string): Promise<boolean> {
    return new Promise(function (resolve, reject) {
        logseq.provideUI({
            key: `logseq-anki-sync-confirm-${logseq.baseInfo.id}`,
            path: "body",
            // Logseq alike dialog template 
            template: `
            <div class="ui__modal anki_sync_confirm" style="z-index: 9999;">
            <div class="ui__modal-overlay ease-out duration-300 opacity-100 enter-done">
               <div class="absolute inset-0 opacity-75"></div>
            </div>
            <div class="ui__modal-panel transform transition-all sm:min-w-lg sm ease-out duration-300 opacity-100 translate-y-0 sm:scale-100 enter-done">
               <div class="absolute top-0 right-0 pt-2 pr-2">
                  <a aria-label="Close" type="button" class="ui__modal-close opacity-60 hover:opacity-100" data-on-click="cancel_action">
                     <svg stroke="currentColor" viewBox="0 0 24 24" fill="none" class="h-6 w-6">
                        <path d="M6 18L18 6M6 6l12 12" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"></path>
                     </svg>
                  </a>
               </div>
               <div class="panel-content">
                  <div class="ui__confirm-modal is-">
                     <div class="sm:flex sm:items-start">
                        <div class="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                           <h2 class="headline text-lg leading-6 font-medium">${msg}</h2>
                           <label class="sublabel">
                              <h3 class="subline text-gray-400"></h3>
                           </label>
                        </div>
                     </div>
                     <div class="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse"><span class="flex w-full rounded-md shadow-sm sm:ml-3 sm:w-auto"><button type="button" class="inline-flex justify-center w-full rounded-md border border-transparent px-4 py-2 bg-indigo-600 text-base leading-6 font-medium text-white shadow-sm hover:bg-indigo-500 focus:outline-none focus:border-indigo-700 focus:shadow-outline-indigo transition ease-in-out duration-150 sm:text-sm sm:leading-5" data-on-click="yes_action">Yes</button></span><span class="mt-3 flex w-full rounded-md shadow-sm sm:mt-0 sm:w-auto"><button type="button" class="inline-flex justify-center w-full rounded-md border border-gray-300 px-4 py-2 bg-white text-base leading-6 font-medium text-gray-700 shadow-sm hover:text-gray-500 focus:outline-none focus:border-blue-300 focus:shadow-outline-blue transition ease-in-out duration-150 sm:text-sm sm:leading-5" data-on-click="cancel_action">Cancel</button></span></div>
                  </div>
               </div>
            </div>
         </div>`,
        });
        logseq.provideStyle(`
            .anki_sync_confirm {display: flex;}
        `);
        logseq.provideModel(
            {
                cancel_action(e) {
                    logseq.provideStyle(`
                        .anki_sync_confirm {display: none;}
                    `);
                    logseq.provideUI({ key: `logseq-anki-sync-confirm-${logseq.baseInfo.id}`, template: `` });
                    resolve(false);
                },
                yes_action(e) {
                    logseq.provideStyle(`
                        .anki_sync_confirm {display: none;}
                    `);
                    logseq.provideUI({ key: `logseq-anki-sync-confirm-${logseq.baseInfo.id}`, template: `` });
                    resolve(true);
                }
            }
        )
    });
}

export class ProgressNotification {
    max: number;
    current: number;
    progressBar: HTMLElement;
    constructor(msg: string, max: number) {
        this.max = max;
        this.current = 0;
        logseq.provideUI({
            key: `logseq-anki-sync-progress-notification-${logseq.baseInfo.id}`,
            path: "div.notifications",
            template: `
            <div class="ui__notifications-content enter-done" style=""><div class="max-w-sm w-full shadow-lg rounded-lg pointer-events-auto notification-area transition ease-out duration-300 transform translate-y-0 opacity-100 sm:translate-x-0"><div class="rounded-lg shadow-xs" style="max-height: calc(100vh - 200px); overflow: hidden scroll;"><div class="p-4"><div class="flex items-start"><div class="flex-shrink-0"><svg stroke="currentColor" viewBox="0 0 24 24" fill="none" class="h-6 w-6 text-green-400"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"></path></svg></div><div class="ml-3 w-0 flex-1">
            <div class="text-sm leading-5 font-medium whitespace-pre-line text-gray-900 dark:text-gray-300 " style="margin: 0px;">${msg}:
            <progress id="logseq-anki-sync-progress-bar-${logseq.baseInfo.id}" value="${this.current}" max="${this.max}" />
            </div>
            </div><div class="ml-4 flex-shrink-0 flex">
            </div></div></div></div></div></div>
            `
        });
    }
    increment() {
        this.current++;
        try{
            if(this.progressBar == null) {
                this.progressBar = window.parent.document.getElementById(`logseq-anki-sync-progress-bar-${logseq.baseInfo.id}`);
            }
            this.progressBar.setAttribute("value", `${this.current}`);
        } catch (e) { }
        if(this.current >= this.max)
            logseq.provideUI({ key: `logseq-anki-sync-progress-notification-${logseq.baseInfo.id}`, template: `` });  // Remove notification
    }
}