# Working on Miso Docs

Whenever documentation content changes, update `public/llms.txt` in the same change. Keep its summaries, reading order, caveats, and links aligned with the current pages. New documentation pages must be added to the curated `docIds` list in `src/lib/llms.ts` so they appear in the Markdown exports and complete-text file. Run the build and verify the linked Markdown routes before publishing.

## Documentation Guidelines

- Organize Move Packages as Overview, Protocol, Protocol Extensions, and Framework. Both Protocol and Protocol Extensions have Party, Composition, Recording, and Release pages. Music objects belong to `miso_music`; Party is a separate `miso_party` protocol. Data-model extensions come from `music-protocol-extensions` and `party-protocol-extensions`; Framework means business-logic contracts and supporting packages. Reserve Platform for the broader SDK and services documentation.

- Standardize on “share type” for a work's `CompositionShare` or `RecordingShare` type, and “shares” for quantities held or transferred. Use `Coin<T>` and `Balance<T>` when referring to concrete Move values.
- Copied or adapted contract excerpts retain their source license, including FSL where applicable. Identify the repository, immutable revision, copyright notice, and license with each excerpt or a clearly scoped page-level notice. Never describe an FSL excerpt as Apache-2.0 merely because it appears in these docs; the docs' Apache grant covers independently written examples and site software.

- Start each page with its reader and outcome. Keep concept pages, step-by-step tasks, and API references distinct, with links at the point where a reader needs the next one.
- Lead with a concrete example when a concept is abstract. Carry the same composition, recording, and release relationships through related pages rather than inventing a new mental model each time.
- Make integration guides reproducible: state prerequisites and pinned source/tool versions, show exact commands and Move code, give the expected result, and say whether a step is local or requires a particular network deployment. Never invent package or registry IDs.
- Keep the protocol section focused on design: identities, relationships, invariants, shares, administration, consent, and why the core is small. Inline short, verbatim excerpts from the smart contracts beside the concepts they explain, such as object definitions, capability boundaries, and consent checks. Explain what each excerpt demonstrates so readers do not need to visit the repository for context. Label partial function bodies as excerpts; avoid turning design pages into publishing walkthroughs. Publishing walkthroughs and transaction construction belong in dedicated implementation guides; TypeScript SDK usage belongs in the future Platform section.
- For a Move API, show the exact function or a small verified excerpt, required objects and ownership, returned values, admin capabilities, events, failure cases, and a source or test link. Do not present a schematic excerpt as a runnable module.
- Put caveats beside the operation they qualify, especially the difference between an on-chain relationship, a rights claim, and a license. Provide a verification checkpoint or a specific recovery path where the reader can get stuck.
- Pin code claims to an immutable upstream commit when describing a concrete API. Check examples against that source and run the relevant Move tests when changing them. Keep the Protocol sidebar order: Overview, Party, Composition, Recording, Release. Explain share types within Overview, Composition, and Recording rather than as a standalone protocol page.
- Use Tailwind's stock stone color tokens or utilities for site colors. Starlight's semantic color variables should map to those tokens; avoid new one-off color values.

These rules are informed by the task/guide/reference separation and working quickstarts in [Stripe](https://docs.stripe.com/checkout/quickstart) and [Bun](https://bun.com/docs/quickstart), the continuing examples and reference format in [React](https://react.dev/learn/thinking-in-react), and the executable examples in [Rust](https://doc.rust-lang.org/book/ch01-02-hello-world.html).

## Screenshots from the Mac

The user captures screenshots on their local Mac; they land on this box in `~/shots/`, newest always at `~/shots/latest.png`.

If the user refers to a screenshot, image, screen, or UI without giving a path, read `~/shots/latest.png`. Run `shotd latest` to resolve the newest path.
