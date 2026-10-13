"""
Runs the first-pass auto-tracer on every plate listed in tools/plates.json.

Usage (from the project root):
  python tools/trace-plates.py              # all plates
  python tools/trace-plates.py marshall-xxxix   # one plate

Writes src/data/traced/<out>.json. A plate whose JSON has been reviewed by hand in the
tracer (meta.reviewed = true) is skipped, so hand corrections are never overwritten.
"""

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
plates = json.loads((ROOT / 'tools' / 'plates.json').read_text())['plates']
only = set(sys.argv[1:])

for p in plates:
    if only and p['id'] not in only:
        continue
    out = ROOT / 'src' / 'data' / 'traced' / p['out']
    if out.exists():
        try:
            if json.loads(out.read_text()).get('meta', {}).get('reviewed'):
                print(f"{p['id']}: reviewed by hand, skipped")
                continue
        except json.JSONDecodeError:
            pass
    image = ROOT / 'data-raw' / p['file']
    if not image.exists():
        print(f"{p['id']}: image not found at {image}, skipped")
        continue
    cmd = [
        sys.executable, str(ROOT / 'tools' / 'autotrace.py'), str(image), str(out),
        '--mpp', str(p['mPerPx']),
        '--anchor-px', str(p['anchorPx'][0]), str(p['anchorPx'][1]),
        '--anchor-scene', str(p['anchorScene'][0]), str(p['anchorScene'][1]),
        '--source', p['source'], '--plate', p['plate'], '--area', p['area'],
        '--page', p['page'], '--level', p['level'],
        '--dark', str(p['dark']), '--min-thick', str(p['minThick']),
        '--drop-glyphs', str(p['glyphs']), '--method', p['method'],
    ]
    for box in p['exclude']:
        cmd += ['--exclude', ','.join(str(v) for v in box)]
    print(f"{p['id']}:", end=' ', flush=True)
    subprocess.run(cmd, check=True)
