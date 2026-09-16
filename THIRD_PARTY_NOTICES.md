# Third-party notices

## Morphic

- Source: <https://github.com/miurla/morphic>
- Inspected commit: `36fa2014ea713a178a7fa0fa0b615195debeeb83`
- License: Apache-2.0 (`LICENSE` present; no `NOTICE` file at this commit)
- Inspected paths: `components/citation-link.tsx`, `components/citation-context.tsx`, `components/answer-section.tsx`, `components/app-sidebar.tsx`, `components/ui/`
- Use in this repository: interaction and dependency-coupling review only. No Morphic source file was copied. The citation interaction was independently redesigned around Source → Evidence → Claim, applicability and access status. Billing, telemetry, accounts and Morphic branding were not imported.

## shadcn/ui and Base UI

- Sources: <https://ui.shadcn.com/> and <https://base-ui.com/>
- License: MIT
- Use: generated accessible UI primitives under `components/ui/`, then composed and restyled for this product.

## Lucide

- Source: <https://lucide.dev/>
- License: ISC
- Use: interface icons through `lucide-react`.

## unpdf

- Source: <https://github.com/unjs/unpdf>
- Version: 1.8.1
- License: MIT
- Use: server-side text extraction from text-layer PDFs.

## Next.js, React, Drizzle ORM and better-sqlite3

These packages are consumed as declared dependencies under their respective upstream licenses. No third-party logo, commercial brand asset, article, interview experience or exam question is bundled with the product.
