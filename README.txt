FARM LEDGER v9 (FQA checklist, GPS map)
=======================================
Build: 2026-10-01-fqa-gps-v9

IMPORTANT FOR EVERY FUTURE BUILD
- board-feed.js must stay in the folder, and index.html must keep the
  <script src="board-feed.js"> tag and the BoardFeed.* calls. Without them
  Tom's Morning Board stops getting Farm Ledger updates.
- Publish with publish-farm-ledger.sh (Downloads) to the existing site.

New in v8
- Paperwork tab: Medicine record, Medicine purchases, Herd register, each
  laid out in DAERA's column order, with Print and Download CSV.
- Herd register (MC3): scan a mart docket; tags are checked with the ear-tag
  check digit; cattle go into the herd, the register and Books.
- Animals that move off or die stay in the register (10-year rule) but leave
  the Livestock list.

New in v9
- Medicine: DAERA "Use", "Purchase" and "Disposal" tables (Meat/Milk/Other
  withdrawal columns, supplier address first time, broken-needle site).
- FQA tab: LMC FQAS inspection checklist; record-based items check themselves.
- Land: road/place labels, GPS "Me" dot, Farm + saved places + field jump buttons.
