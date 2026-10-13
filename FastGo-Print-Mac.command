#!/bin/bash
set -eu
FASTGO_CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
if [ ! -x "$FASTGO_CHROME" ]; then
 echo "Install Google Chrome, then run this file again."
 exit 1
fi
echo "1 - First setup: sign in and select a printer using the test page."
echo "2 - Start without print confirmation."
echo "Close the previous FastGo Print window before switching modes."
read -r -p "Select 1 or 2: " FASTGO_MODE
FASTGO_PROFILE="$HOME/Library/Application Support/FastGoPrintProfile"
if [ "$FASTGO_MODE" = "2" ]; then
 exec "$FASTGO_CHROME" --user-data-dir="$FASTGO_PROFILE" --disable-background-mode --kiosk-printing --app="https://ivankirillov414-art.github.io/fastgo-control/print-station.html?silent=1"
else
 exec "$FASTGO_CHROME" --user-data-dir="$FASTGO_PROFILE" --disable-background-mode --app="https://ivankirillov414-art.github.io/fastgo-control/print-station.html?setup=1"
fi
