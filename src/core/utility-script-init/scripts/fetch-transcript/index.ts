import mri from "mri";
import {fetchBilibiliTranscript} from "./fetchBilibili";
import {fetchYouTubeTranscript} from "./fetchYouTube";
import {parseVideoInput} from "./parseVideoInput";

interface TranscriptArguments {
    input: string;
    language?: string;
    pretty: boolean;
}

function parseArguments(rawArgs: string[]): TranscriptArguments {
    const unknownOptions: string[] = [];
    const args = mri<{language?: string; pretty: boolean}>(rawArgs, {
        alias: {language: "l"},
        boolean: "pretty",
        string: "language",
        default: {pretty: false},
        unknown: (option) => unknownOptions.push(option)
    });
    if (unknownOptions.length > 0) throw new Error(`Unknown option: ${unknownOptions[0]}`);
    if (args._.length !== 1) {
        throw new Error("Usage: fetch-transcript.js [--language CODE] [--pretty] VIDEO_URL_OR_ID");
    }
    return {input: args._[0], language: args.language, pretty: args.pretty};
}

async function main(): Promise<void> {
    const args = parseArguments(process.argv.slice(2));
    const video = parseVideoInput(args.input);
    const result =
        video.provider === "youtube"
            ? await fetchYouTubeTranscript(video.videoId, args.language ?? "en")
            : await fetchBilibiliTranscript(video.videoId, video.page, args.language);
    // biome-ignore lint/suspicious/noConsole: stdout is the utility's public result channel.
    console.log(JSON.stringify(result, null, args.pretty ? 2 : undefined));
}

globalThis.__utilityPromise = main();
