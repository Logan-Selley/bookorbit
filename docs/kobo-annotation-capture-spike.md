# Kobo annotation sync — capture spike

Throwaway evidence-gathering for reading-services protocol questions. **Not for production.**

## Enable locally

Add to `server/.env`:

```env
KOBO_ANNOTATION_CAPTURE=1
KOBO_CAPTURE_USER_ID=<your BookOrbit user id>
# optional:
# KOBO_CAPTURE_OUTPUT_DIR=/path/to/captures
```

Restart the dev server (`pnpm dev` or `pnpm run dev:server`). On startup you should see:

```
[kobo.capture] Annotation capture ACTIVE — writing to .../server/.kobo-captures
```

Pair your Kobo as usual. After the next **library sync**, initialization will return `reading_services_host` pointing at BookOrbit instead of Kobo — the device will then send annotation traffic through you.

## Output

| File                                                     | Purpose                                                      |
| -------------------------------------------------------- | ------------------------------------------------------------ |
| `server/.kobo-captures/capture.log`                      | One-line human summary per request (tail this while testing) |
| `server/.kobo-captures/<timestamp>_<method>_<path>.json` | Full request + Kobo response + bookId resolution             |

### Summary line format

```
2026-06-07T20:30:00.000Z | POST /api/v3/content/checkforchanges | → 200 | resolved=[abc12345…→42] | etag=... | changed=["..."] | file=...
```

### JSON record fields

- **request** — method, path, all headers, body (includes `highlightedText` / `noteText` — local only)
- **resolution.entries** — per `ContentId`: `bookId` if BookOrbit-managed, else `null`
- **upstream** — what Kobo returned (status, headers including `ETag`, parsed body)

## Device scenarios to run

Run in order where possible; note the scenario letter in your notes when each capture fires.

| Scenario | Action on Kobo                                                | Answers                                                   |
| -------- | ------------------------------------------------------------- | --------------------------------------------------------- |
| **A**    | One BookOrbit book → add **one highlight** → sync             | Baseline payload shape, initial etag                      |
| **B**    | Same book → add **second highlight** → sync                   | Q1: does etag change when count changes?                  |
| **C**    | Same book → **delete** a highlight → sync                     | Q6: `deletedAnnotationIds` vs set diff; etag after delete |
| **D**    | **Kobo-purchased** book → add highlight → sync                | Control: forward path + Kobo-owned etag behavior          |
| **E**    | **Mixed**: BookOrbit + Kobo book, both with highlights → sync | Q4: batch `checkforchanges` — one etag or many?           |
| **F**    | Add a **note** (not just highlight) + a **dogear** → sync     | Q7: `type` values; dogear → bookmarks not annotations     |

Between scenarios, wait for sync to complete. Opening the book or pulling to refresh often triggers reading-services.

## What to look for in captures

### Q1 — Etag scope (per-annotation / per-book / account)

Compare `ETag` / `etag` fields across A → B → C:

- Same token after add? → likely per-book or account-stable until change
- New token each annotation? → per-annotation (unlikely)
- One token in `checkforchanges` batch for E with two books? → account-level vs per-ContentId

**Pattern:** grep `capture.log` for `etag=` across sequential files.

### Q2 — Etag direction (device vs server authority)

In each JSON file compare:

- Request: `If-None-Match` / `If-Match` headers and body `ETag` fields on `checkforchanges` entries
- Response: `upstream.headers.etag` and body `ETag`

Does the device send its last-known etag and expect 304, or does Kobo issue a new etag the device stores?

### Q3 — Can BookOrbit generate etags?

After capture, note the **format** of Kobo etags (length, charset, opaque blob vs structured). Production may use a server hash if the device only does string equality — this is a design call after reviewing real tokens.

### Q4 — Mixed batch (scenario E)

In `checkforchanges` **request** body: array of `{ ContentId, ETag? }` — one entry per book?

In **response**: `ChangedContentIds` only, or etags per id? How would split handle (BookOrbit local + Kobo forward)?

### Q6 — Deletion (scenario C)

PATCH body: look for `deletedAnnotationIds` array vs full annotation list replacement.

### Q7 — Types (scenario F)

PATCH `updatedAnnotations[]`: `type` field values (`highlight`, `note`, `dogear`?). Which fields each type carries. Dogears likely separate from highlights.

## Headers worth confirming every capture

- `x-kobo-deviceid` — present (same as analytics)
- `if-match` / `if-none-match` on GET/PATCH
- Response `etag` header vs JSON `ETag` field

## Tear down

Unset `KOBO_ANNOTATION_CAPTURE` before merging any production PR. Delete `server/src/modules/kobo/spike/` when done.
