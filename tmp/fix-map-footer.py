from pathlib import Path
p=Path('src/LandingCourseNetwork.tsx')
s=p.read_text(encoding='utf-8')
s=s.replace('<div className="map-canvas">','<div className="map-canvas">\n                <div className="map-scroll" tabIndex={0} role="region" aria-label="Scrollable course map">',1)
s=s.replace('<div className="map-legend">','</div>\n                <div className="map-canvas-footer">\n                <div className="map-legend">',1)
s=s.replace('              <div className="course-detail-strip"','              </div>\n              <div className="course-detail-strip"',1)
p.write_text(s,encoding='utf-8')
