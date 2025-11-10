```bash
export FN_NO_EXT=sample

# Embed soft subtitle as text stream
ffmpeg -i "sample.mp4" -i "sample.srt" \
  -c:v copy \
  -c:a copy \
  -c:s mov_text \
  -metadata:s:s:0 language=eng \
  -map 0 \
  -map 1:0 \
  "sample.soft.mp4"

# For Chrome we need WebVtt - as external subtitles
ffmpeg -i sample.srt sample.vtt
```

## Sample Server

```bash
python3 -m http.server 8000
```

Click `simple_example_player.html` to watch the video with soft subtitles enabled.

## Video File

Downloaded from Wikimedia, free to use - <https://commons.wikimedia.org/wiki/File:Powdered_Oakblue_(Arhopala_bazalus).webm>
