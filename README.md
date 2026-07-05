# Blackout

Local-only image redaction. Drop a screenshot, draw black boxes, download a safe copy.

**Your file never leaves your device** — and you don't have to take that on faith:

- **No backend.** Static files only. Host it anywhere (GitHub Pages, Cloudflare Pages) or open `index.html` from disk.
- **No network, enforced.** The page ships a `Content-Security-Policy` with `connect-src 'none'` and `default-src 'none'`. The browser itself blocks any request. Open devtools and watch: nothing leaves.
- **No dependencies.** ~300 lines of vanilla JS. Read all of it in a few minutes.
- **Works offline.** A service worker caches the four files; after the first visit it runs with the network cable unplugged.

## What it does

- Solid black rectangles only — no blur or pixelation (both are reversible in some cases; black is not).
- Export is a **flattened re-encode**: a fresh canvas gets the image pixels plus black fills, then encodes to PNG or JPG. The pixels under a box are gone, not covered.
- **Metadata is stripped automatically.** Canvas re-encoding discards EXIF, GPS location, XMP — everything. EXIF rotation is baked into the pixels first, so phone photos come out the right way up.
- Input: drag & drop, paste (⌘V), or browse. Undo with ⌘Z.
- Output: download as PNG/JPG, or copy straight to the clipboard (always PNG — browsers only accept PNG for image clipboard writes).

## What it deliberately doesn't do

No accounts, no uploads, no analytics, no cookies, no storage of your images, no blur tool, no editor features. It redacts.

## Run it

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

Or just open `index.html` in a browser (everything works except offline caching, which requires http/https).
