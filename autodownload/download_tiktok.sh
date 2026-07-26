#!/usr/bin/env bash
set -e

mkdir -p downloads

read -p "Enter the TikTok channel URL or username (e.g. @username): " CHANNEL
if [ -z "$CHANNEL" ]; then
    echo "No channel entered. Exiting."
    exit 0
fi

read -p "Enter the minimum view count filter (press Enter for no filter): " MIN_VIEWS

# Determine yt-dlp binary
if [ -f "./yt-dlp" ]; then
    YTDLP_CMD="./yt-dlp"
elif command -v yt-dlp >/dev/null 2>&1; then
    YTDLP_CMD="yt-dlp"
else
    echo "Error: yt-dlp binary not found. Please install yt-dlp or place binary in autodownload/yt-dlp."
    exit 1
fi

YTDLP_OUTPUT="downloads/%(uploader)s/%(upload_date)s_%(id)s.%(ext)s"

if [[ "$CHANNEL" != http* ]]; then
    CHANNEL_URL="https://www.tiktok.com/$CHANNEL"
else
    CHANNEL_URL="$CHANNEL"
fi

echo "Downloading videos from $CHANNEL_URL..."

if [ -n "$MIN_VIEWS" ]; then
    "$YTDLP_CMD" -o "$YTDLP_OUTPUT" --write-description -S "vcodec:h264,res,acodec" --match-filter "view_count >= $MIN_VIEWS" "$CHANNEL_URL"
else
    "$YTDLP_CMD" -o "$YTDLP_OUTPUT" --write-description -S "vcodec:h264,res,acodec" "$CHANNEL_URL"
fi

echo "Download complete."
