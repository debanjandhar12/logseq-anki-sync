import {fetchBilibiliTranscript} from "./fetchBilibili";
import {fetchYouTubeTranscript} from "./fetchYouTube";
import {parseVideoInput} from "./parseVideoInput";

interface Arguments {
    input: string;
    language?: string;
    pretty: boolean;
}

function parseArguments(rawArgs: string[]): Arguments {
    let language: string | undefined;
    let pretty = false;
    const positional: string[] = [];
    for (let index = 0; index < rawArgs.length; index++) {
        const value = rawArgs[index];
        if (value === "--pretty") pretty = true;
        else if (value === "--language" || value === "-l") {
            language = rawArgs[++index];
            if (!language) throw new Error(`${value} requires a language code.`);
        } else if (value.startsWith("-")) throw new Error(`Unknown option: ${value}`);
        else positional.push(value);
    }
    if (positional.length !== 1) {
        throw new Error("Usage: fetch-transcript.js [--language CODE] [--pretty] VIDEO_URL_OR_ID");
    }
    return {input: positional[0], language, pretty};
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
