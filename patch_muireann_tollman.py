#!/usr/bin/env python3
"""
patch_muireann_tollman.py

Fixes a real gating bug in Muireann's "His toll-man?" dialogue option in
public/data/bog/d3Sea.js: the variant for players who gave their real name
only checked `knows_own_name`, never `knows_of_tollman`, so it could appear
before "Fionnbarra?" had ever been asked.

Per discussion, this also drops the password/no-password distinction
entirely (she now always gives the password once the toll-man's been
mentioned, regardless of whether the player's real name was given) --
simpler than threading a third note through the @when-per-option limit.

Merges the two "His toll-man?" options into one, gated only on
knows_of_tollman.

NOTE ON THE .dlg SOURCE: this patches the compiled JS directly rather than
tools/dialogue/drafts/d3Sea.dlg, since the two may already be out of sync
(this session found the same fix already present upstream on GitHub's
theButterfly branch, while this local file still had the bug -- so treat
this compiled file as the current source of truth for this scene, not
necessarily the local .dlg draft). Worth porting the same merge into your
local d3Sea.dlg by hand next time you're in there, so a future
`node tools/dialogue/compile.mjs` doesn't silently reintroduce this option
split.

Idempotent: safe to run more than once.

Run from the repo root:
    python3 patch_muireann_tollman.py
"""
from pathlib import Path

ROOT = Path.cwd()
TARGET = "public/data/bog/d3Sea.js"

OLD = """            {
              requires: { note: 'knows_own_name', noteAbsent: 'has_druid_word' },
              note: 'has_druid_word',
              ga: 'A fhear dola?',
              en: 'His toll-man?',
              say: 'A fhear dola?',
              sayEn: 'His toll-man?',
              replyGa: 'Mar seo a dhéanann sé gnó:\\nan té nach ngoidfidh sé uaidh, cuirfidh sé moill air.\\nMá chasann fear dola Fhionnbarra ort ar an gcladach,\\nabair leis go bhfuil d\\'ainm ag Muireann an Draoi.',
              replyEn: 'Such is how he does business:\\nwhom he robs not, he delays.\\nIf Fionnbarra\\'s toll-man should meet thee at the strand,\\nthou art to say that Muireann the Druid knows thy name.',
            },
            {
              requires: { note: 'knows_of_tollman', noteAbsent: 'knows_own_name' },
              ga: 'A fhear dola?',
              en: 'His toll-man?',
              say: 'A fhear dola?',
              sayEn: 'His toll-man?',
              replyGa: 'Mar seo a dhéanann sé gnó:\\nan té nach ngoidfidh sé uaidh, cuirfidh sé moill air.',
              replyEn: 'Such is how he does business:\\nwhom he robs not, he delays.',
            },"""

NEW = """            {
              requires: { note: 'knows_of_tollman', noteAbsent: 'has_druid_word' },
              note: 'has_druid_word',
              ga: 'A fhear dola?',
              en: 'His toll-man?',
              say: 'A fhear dola?',
              sayEn: 'His toll-man?',
              replyGa: 'Mar seo a dhéanann sé gnó:\\nan té nach ngoidfidh sé uaidh, cuirfidh sé moill air.\\nMá chasann fear dola Fhionnbarra ort ar an gcladach,\\nabair leis go bhfuil d\\'ainm ag Muireann an Draoi.',
              replyEn: 'Such is how he does business:\\nwhom he robs not, he delays.\\nIf Fionnbarra\\'s toll-man should meet thee at the strand,\\nthou art to say that Muireann the Druid knows thy name.',
            },"""

path = ROOT / TARGET
if not path.exists():
    print(f"✗ {TARGET} does not exist -- run this from the repo root")
    raise SystemExit(1)

text = path.read_text(encoding="utf-8")

if NEW in text:
    print("• already applied, skipping")
elif OLD not in text:
    print(f"✗ expected text not found in {TARGET} -- file has drifted further, "
          f"apply by hand: merge the two 'His toll-man?' options into one, "
          f"gated on `requires: {{ note: 'knows_of_tollman', noteAbsent: 'has_druid_word' }}`, "
          f"keeping the longer reply (the one that gives the password).")
else:
    count = text.count(OLD)
    if count > 1:
        print(f"✗ match is not unique ({count}x) -- apply by hand")
    else:
        path.write_text(text.replace(OLD, NEW, 1), encoding="utf-8")
        print(f"✓ merged the two 'His toll-man?' options in {TARGET}")
