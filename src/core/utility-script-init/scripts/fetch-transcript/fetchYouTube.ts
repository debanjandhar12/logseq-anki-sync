import {getVideoDetails} from "youtube-caption-extractor";
import type {TranscriptResult} from "./types";

export async function fetchYouTubeTranscript(
    videoId: string,
    language: string
): Promise<TranscriptResult> {
    const details = await getVideoDetails({videoID: videoId, lang: language, fetch});
    if (details.subtitles.length === 0) {
        throw new Error(`No YouTube transcript is available for language '${language}'.`);
    }
    return {
        provider: "youtube",
        videoId,
        title: details.title,
        language,
        segments: details.subtitles.map(({start, dur, text}) => ({
            start: Number(start),
            duration: Number(dur),
            text
        }))
    };
}
