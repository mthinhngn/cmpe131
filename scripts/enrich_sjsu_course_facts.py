"""Parse captured course pages once for the program importer; no network or model calls."""
import json
from concurrent.futures import ProcessPoolExecutor
import import_sjsu_programs as programs

def parse(coid):
    programs._IGNORE_FACTS_CACHE = True
    return coid, programs.course_facts(coid)

if __name__ == "__main__":
    ids = [p.stem for p in (programs.DIRECTORY / "courses").glob("*.html")]
    facts = {}
    with ProcessPoolExecutor(max_workers=4) as pool:
        for i, (key, record) in enumerate(pool.map(parse, ids)):
            facts[key] = record
            if i and i % 500 == 0: print(f"Parsed {i}/{len(ids)} course pages", flush=True)
    (programs.DIRECTORY / "course-facts.json").write_text(json.dumps(facts, ensure_ascii=False), encoding="utf-8")
    print(f"Parsed {len(facts)} captured course pages.")
