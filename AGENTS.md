# Working on Miso Docs

Whenever documentation content changes, update `public/llms.txt` in the same change. Keep its summaries, reading order, caveats, and links aligned with the current pages. New documentation pages must be added to the curated `docIds` list in `src/lib/llms.ts` so they appear in the Markdown exports and complete-text file. Run the build and verify the linked Markdown routes before publishing.

## Screenshots from the Mac

The user captures screenshots on their local Mac; they land on this box in `~/shots/`, newest always at `~/shots/latest.png`.

If the user refers to a screenshot, image, screen, or UI without giving a path, read `~/shots/latest.png`. Run `shotd latest` to resolve the newest path.
