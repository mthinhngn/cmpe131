from pathlib import Path
import json
# Verify lower-page markup remains the new source's exact content.
a=Path('tmp/courseradar-reference-v2/client/src/pages/Home.tsx').read_text(encoding='utf-8')
b=Path('src/ReferenceLanding.tsx').read_text(encoding='utf-8')
assert a.replace('"@/components/CourseNetwork"','"./LandingCourseNetwork"')==b
assert Path('src/LandingCourseNetwork.tsx').read_bytes()==Path('tmp/courseradar-reference-v2/client/src/components/CourseNetwork.tsx').read_bytes()
print('ZIP v2 Home matches except local import; CourseNetwork matches exact bytes.')
for viewport in (1280,1440,1920):
 content=viewport-15
 left=max(32,(content-1280)/2)
 available=content-left-24
 gap=min(60,max(32,.03*viewport))
 copy=(available-gap)*.36
 window=(available-gap)*.64
 print(json.dumps({'viewport':viewport,'copyLeft':left,'copyWidth':round(copy,1),'windowLeft':round(left+copy+gap,1),'windowWidth':round(window,1),'rightGutter':24}))
