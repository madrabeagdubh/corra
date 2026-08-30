#!/usr/bin/env python3
"""
patch_muireann_tollman_dlg.py

Companion to patch_muireann_tollman.py, but at the source this time.
Fixes tools/dialogue/drafts/d3Sea.dlg directly, so the next time you edit
dialogue here and run compile.mjs, it won't regenerate the old two-option
"His toll-man?" split (the one gated only on knows_own_name, with no
knows_of_tollman check) and undo the fix.

Same merge as before: one option, gated on knows_of_tollman, password given
regardless of whether the real name was given.

After this runs, recompile:
    node tools/dialogue/compile.mjs tools/dialogue/drafts/d3Sea.dlg

Idempotent: safe to run more than once.

Run from the repo root:
    python3 patch_muireann_tollman_dlg.py
"""
from pathlib import Path

ROOT = Path.cwd()
TARGET = "tools/dialogue/drafts/d3Sea.dlg"

OLD = """# The password is "Muireann the Druid knows thy name", so it cannot be
# given to someone whose name she does not have.

* His toll-man?
% A fhear dola?
@when note knows_own_name
@when !note has_druid_word
@note has_druid_word
> His toll-man?
% A fhear dola?
< Such is how he does business:
% Mar seo a dhéanann sé gnó:
< whom he robs not, he delays.
% an té nach ngoidfidh sé uaidh, cuirfidh sé moill air.
< If Fionnbarra's toll-man should meet thee at the strand,
% Má chasann fear dola Fhionnbarra ort ar an gcladach,
< thou art to say that Muireann the Druid knows thy name.
% abair leis go bhfuil d'ainm ag Muireann an Draoi.

* His toll-man?
% A fhear dola?
@when note knows_of_tollman
@when !note knows_own_name
> His toll-man?
% A fhear dola?
< Such is how he does business:
% Mar seo a dhéanann sé gnó:
< whom he robs not, he delays.
% an té nach ngoidfidh sé uaidh, cuirfidh sé moill air."""

NEW = """# The password is "Muireann the Druid knows thy name", given regardless of
# whether she actually knows it -- simplified from an earlier two-branch
# version gated on knows_own_name. The only remaining gate is having asked
# "Fionnbarra?" (knows_of_tollman) -- what matters is that the toll-man's
# been raised at all, not what she calls you.

* His toll-man?
% A fhear dola?
@when note knows_of_tollman
@when !note has_druid_word
@note has_druid_word
> His toll-man?
% A fhear dola?
< Such is how he does business:
% Mar seo a dhéanann sé gnó:
< whom he robs not, he delays.
% an té nach ngoidfidh sé uaidh, cuirfidh sé moill air.
< If Fionnbarra's toll-man should meet thee at the strand,
% Má chasann fear dola Fhionnbarra ort ar an gcladach,
< thou art to say that Muireann the Druid knows thy name.
% abair leis go bhfuil d'ainm ag Muireann an Draoi."""

path = ROOT / TARGET
if not path.exists():
    print(f"✗ {TARGET} does not exist -- run this from the repo root")
    raise SystemExit(1)

text = path.read_text(encoding="utf-8")

if NEW in text:
    print("• already applied, skipping")
elif OLD not in text:
    print(f"✗ expected text not found in {TARGET} -- draft has drifted further "
          f"than expected, apply by hand: merge the two 'His toll-man?' options "
          f"into one gated on `@when note knows_of_tollman` / "
          f"`@when !note has_druid_word` / `@note has_druid_word`, keeping the "
          f"longer reply (the one with the password).")
else:
    count = text.count(OLD)
    if count > 1:
        print(f"✗ match is not unique ({count}x) -- apply by hand")
    else:
        path.write_text(text.replace(OLD, NEW, 1), encoding="utf-8")
        print(f"✓ merged the two 'His toll-man?' options in {TARGET}")
        print("  now run: node tools/dialogue/compile.mjs tools/dialogue/drafts/d3Sea.dlg")
