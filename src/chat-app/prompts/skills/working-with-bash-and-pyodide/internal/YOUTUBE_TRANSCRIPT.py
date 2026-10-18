import json
import micropip

await micropip.install("youtube-transcript-api==1.2.4")

from youtube_transcript_api import YouTubeTranscriptApi

transcript = YouTubeTranscriptApi().fetch("4-mMN9NSWE8", languages=["en"])
print(json.dumps(transcript.to_raw_data(), ensure_ascii=False))
