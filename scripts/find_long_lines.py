from pathlib import Path
import sys

if len(sys.argv) < 2:
    print('usage: find_long_lines.py <file>')
    sys.exit(1)

p = Path(sys.argv[1])
if not p.exists():
    print('file not found', file=sys.stderr)
    sys.exit(1)

for i, l in enumerate(p.read_text().splitlines(), start=1):
    if len(l) > 79:
        print(i, len(l), l)
