import type {TranscriptResult} from "./types";

interface BilibiliSubtitle {
    lan?: string;
    lan_doc?: string;
    subtitle_url: string;
}

async function fetchJson(url: string): Promise<any> {
    const response = await fetch(url);
    if (!response.ok)
        throw new Error(`Request failed (${response.status} ${response.statusText}).`);
    return response.json();
}

export async function fetchBilibiliTranscript(
    videoId: string,
    page: number,
    requestedLanguage?: string
): Promise<TranscriptResult> {
    const pages = await fetchJson(
        `https://api.bilibili.com/x/player/pagelist?bvid=${encodeURIComponent(videoId)}`
    );
    const selectedPage =
        pages.code === 0 && Array.isArray(pages.data) ? pages.data[page - 1] : null;
    if (!selectedPage?.cid) throw new Error(`Bilibili video page ${page} does not exist.`);

    const player = await fetchJson(
        `https://api.bilibili.com/x/player/v2?bvid=${encodeURIComponent(videoId)}&cid=${encodeURIComponent(selectedPage.cid)}`
    );
    const subtitles = player?.data?.subtitle?.subtitles;
    if (player.code !== 0 || !Array.isArray(subtitles) || subtitles.length === 0) {
        throw new Error("No public Bilibili transcript is available.");
    }

    const selected = chooseSubtitle(subtitles, requestedLanguage);
    const subtitleUrl = selected.subtitle_url.startsWith("//")
        ? `https:${selected.subtitle_url}`
        : selected.subtitle_url;
    const caption = await fetchJson(subtitleUrl);
    if (!Array.isArray(caption.body)) throw new Error("Bilibili returned an invalid transcript.");

    return {
        provider: "bilibili",
        videoId,
        title: selectedPage.part || undefined,
        language: selected.lan || selected.lan_doc || requestedLanguage || "unknown",
        segments: caption.body.map((segment: any) => ({
            start: Number(segment.from),
            duration: Math.max(0, Number(segment.to) - Number(segment.from)),
            text: String(segment.content ?? "")
        }))
    };
}

function chooseSubtitle(
    subtitles: BilibiliSubtitle[],
    requestedLanguage?: string
): BilibiliSubtitle {
    if (!requestedLanguage) {
        return subtitles.find(({lan}) => /^en(?:-|$)/i.test(lan ?? "")) ?? subtitles[0];
    }
    const requested = requestedLanguage.toLowerCase();
    const match = subtitles.find(({lan, lan_doc}) =>
        [lan, lan_doc].some((value) => value?.toLowerCase() === requested)
    );
    if (!match)
        throw new Error(`Bilibili transcript language '${requestedLanguage}' is unavailable.`);
    return match;
}
