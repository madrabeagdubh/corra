#!/usr/bin/env python3
"""
patch_poem_update.py — run from the repo root. Idempotent.

Replaces the POEM array in js/introOghamDial.js with the eleven new couplets.

Unlike the usual exact-text anchors, this one finds the array STRUCTURALLY:
from `const POEM=[` to its closing `];`, whatever is currently between them.
The previous version matched on the old poem verbatim and found nothing, which
means the working copy had already moved on from what was committed. Matching
the shape rather than the contents avoids that whole class of failure — and for
a block that is meant to be edited by hand, shape is the only stable thing.

The old block is printed before it is replaced, so it is recoverable from your
terminal scrollback even if it was never committed.

TOTAL_ARC, the ring spacing and the reading column are all derived from
POEM.length and the English word counts at load time, so nothing else needs to
change. Note this poem is shorter — 62 English words against about 100 — so the
sequence, and the dolly that now rides it, run roughly a third quicker.
"""

import io, os, re, sys

PATH = 'js/introOghamDial.js'

NEW = """const POEM=[
        {ga:'Is fada mé i ndorchadas',                en:'Long am I in darkness'},
        {ga:'Feicim Slua Reann ag ardú',              en:'I see the bright ones climb'},
        {ga:'Rianaím a ngathanna geala in airde',     en:'I trace their flashing spears upraised'},
        {ga:'fós ní scaoilfidh siad a rúin!',         en:'yet they part not with their counsel!'},
        {ga:'A Gealach',                              en:'O bright one'},
        {ga:'A Ríona Bhabhainn is Bhuanna',           en:'O Queen of Boyne and Bann'},
        {ga:'Le seacht n-uaire solas an laoich',      en:'With seven times a hero\\u2019s light'},
        {ga:'Gairim ort!',                            en:'I call thee forth!'},
        {ga:'Soilsigh droim na Teamhrach',            en:'Shine down upon the ridge of Tara'},
        {ga:'srianaigh na taoisigh uaibhreacha',      en:'bridle these haughty chiefs'},
        {ga:'is nocht a rúin dod ghiolla',            en:'and lay their secrets bare before thy servant'},
      ];"""


def main():
    if not os.path.isfile(PATH):
        sys.exit('! %s not found — run this from the repo root.' % PATH)
    src = io.open(PATH, encoding='utf-8').read()

    m = re.search(r'const\s+POEM\s*=\s*\[', src)
    if not m:
        sys.exit('! no POEM array found in %s.' % PATH)
    start = m.start()
    end = src.find('];', start)
    if end == -1:
        sys.exit('! POEM array is not closed. Nothing written.')
    end += 2

    old = src[start:end]
    if 'ga:' not in old:
        sys.exit('! that does not look like the poem array. Nothing written.')
    if old == NEW:
        print('  = already applied.'); return

    print('--- replacing (keep this if it was never committed) ---')
    print(old)
    print('--- with %d couplets ---' % NEW.count('{ga:'))

    io.open(PATH, 'w', encoding='utf-8').write(src[:start] + NEW + src[end:])
    print('Wrote %s.' % PATH)


if __name__ == '__main__':
    main()
