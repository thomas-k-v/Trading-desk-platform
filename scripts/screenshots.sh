#!/usr/bin/env bash
# Regenerates docs/images/*.png from a running dev server (npm run dev) using headless Chrome.
set -euo pipefail
cd "$(dirname "$0")/.."
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
BASE="${BASE:-http://localhost:5173}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

shot() { # name query
  "$CHROME" --headless=new --user-data-dir="$TMP/$1" --hide-scrollbars --window-size=1440,900 \
    --virtual-time-budget=6000 --screenshot="docs/images/$1.png" "$BASE/?tour=0&variant=smart&$2" >/dev/null 2>&1
}
mshot() { # phone-width shots go through public/mobile.html, then get cropped to 390x844
  "$CHROME" --headless=new --user-data-dir="$TMP/$1" --hide-scrollbars --window-size=800,844 \
    --virtual-time-budget=6000 --screenshot="docs/images/$1.png" "$BASE/mobile.html?tour=0&variant=smart&$2" >/dev/null 2>&1
  sips -c 844 390 "docs/images/$1.png" >/dev/null
}

# Current monthly NIFTY future symbol (last Tuesday of the month), URL-encoded.
FUT="$(node -e "const m=['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];const d=new Date();const lt=(y,mo)=>{const x=new Date(y,mo+1,0,15,30);while(x.getDay()!==2)x.setDate(x.getDate()-1);return x};let e=lt(d.getFullYear(),d.getMonth());if(e<d)e=lt(d.getFullYear(),d.getMonth()+1);console.log(encodeURIComponent('NIFTY '+m[e.getMonth()]+' FUT'))")"

shot dashboard "page=dashboard" &
shot chart "page=chart&symbol=RELIANCE" &
shot order-pad-smart "page=dashboard&pad=$FUT&qty=10" &
shot option-chain "page=optionchain" &
wait
shot holdings "page=holdings" &
shot funds "page=funds" &
shot mutual-funds "page=mutualfunds" &
shot alerts "page=alerts" &
wait
mshot mobile-watchlist "page=watchlist" &
mshot mobile-order-pad "page=watchlist&pad=INFY&side=SELL&qty=50" &
mshot mobile-holdings "page=holdings" &
wait
echo "Screenshots written to docs/images/"
