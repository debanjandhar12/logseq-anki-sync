import type {ParsedVideoInput} from "./types";

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const BILIBILI_ID = /^BV[0-9A-Za-z]+$/;

export function parseVideoInput(input: string): ParsedVideoInput {
    if (YOUTUBE_ID.test(input)) return {provider: "youtube", videoId: input, page: 1};
    if (BILIBILI_ID.test(input)) return {provider: "bilibili", videoId: input, page: 1};

    let url: URL;
    try {
        url = new URL(input);
    } catch {
        throw new Error("Expected a YouTube or Bilibili video URL or ID.");
    }

    const host = url.hostname.toLowerCase();
    if (host === "youtu.be" || host.endsWith(".youtu.be")) {
        return youtubeResult(url.pathname.split("/").filter(Boolean)[0]);
    }
    if (host === "youtube.com" || host.endsWith(".youtube.com")) {
        return youtubeResult(
            url.searchParams.get("v") ?? url.pathname.match(/^\/(?:shorts|embed)\/([^/]+)/)?.[1]
        );
    }
    if (host === "bilibili.com" || host.endsWith(".bilibili.com")) {
        const videoId = url.pathname.match(/\/(BV[0-9A-Za-z]+)/)?.[1];
        const page = Number(url.searchParams.get("p") ?? "1");
        if (!videoId || !Number.isSafeInteger(page) || page < 1) {
            throw new Error("Invalid Bilibili video URL.");
        }
        return {provider: "bilibili", videoId, page};
    }
    throw new Error("Only YouTube and Bilibili videos are supported.");
}

function youtubeResult(videoId: string | null | undefined): ParsedVideoInput {
    if (!videoId || !YOUTUBE_ID.test(videoId)) throw new Error("Invalid YouTube video URL.");
    return {provider: "youtube", videoId, page: 1};
}
