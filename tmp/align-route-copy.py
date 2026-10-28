from pathlib import Path
p=Path('src/ReferenceOverview.tsx');s=p.read_text(encoding='utf-8')
s=s.replace('Open semester planner','Open prerequisite map').replace('Course explorer <ArrowUpRight','Prerequisite map <ArrowUpRight').replace('Add a course to your plan','Explore the prerequisite map').replace('Explore options <ArrowRight','Explore prerequisites <ArrowRight').replace('Open the semester planner when you’re ready to turn this overview into a schedule.','Open the prerequisite map to review how your next courses connect.')
p.write_text(s,encoding='utf-8')
p=Path('src/PrerequisiteMap.tsx');s=p.read_text(encoding='utf-8').replace('Open your SJSU catalog map','Return to map');p.write_text(s,encoding='utf-8')
