from pathlib import Path
p=Path('docs/SEMESTER_PLANNER_IMPLEMENTATION.md')
s=p.read_bytes().decode('utf-8', errors='surrogateescape')
s=''.join(bytes([ord(c)-0xdc00]).decode('cp1252') if 0xdc80 <= ord(c) <= 0xdcff else c for c in s)
s=s.replace('a pale lavender workload chart','a limestone workload chart')
s=s.replace('the pale lavender workload chart','the limestone workload chart')
s=s.replace('periwinkle tints distinguish planned and in-progress chart segments','graphite and indigo distinguish planned and in-progress chart segments')
s += '''
## Desktop gutters, chart contrast, and semester spacing - 2026-10-27

Applied the latest browser feedback: desktop header and content use 32px gutters at 1242px instead of 48px. The chart uses landing limestone #f4f4f2, dark neutral text, graphite planned segments #6f7680, and indigo in-progress segments #3f54a6. This supersedes the earlier lavender palette.

Removed the first semester's zero-left-padding exception. Every desktop semester button now uses 12px top, 14px horizontal, and 16px bottom padding, with equal column widths. Long plans retain contained horizontal scrolling.

Verified in desktop Edge at 1242x668 with ten semesters: all ten buttons have identical computed padding and 130px widths; left/right gutters measure 32px; chart background and bar colors match the new palette; selecting Semester 10 updates the library filter; no page overflow or runtime errors. Captured and inspected .impeccable/review/planner-spacing-desktop.png. This pass changes CSS only; planning logic remains covered by the earlier functional checks.
'''
p.write_text(s, encoding='utf-8')

