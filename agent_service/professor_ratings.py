"""Public, school-checked RMP metrics. No student data or model-written queries."""
import base64
import json
import logging
import re
import time
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from threading import RLock
from .kimi_budget import active_budget
from .web_tools import https_bytes

log = logging.getLogger("course-radar-agent")
# Schedule imports this same file. Keep it in the agent container's build context.
PROFILE_PATH = Path(__file__).resolve().parent / 'data/professor-profiles.json'
SCHOOL = 'U2Nob29sLTg4MQ=='
UNASSIGNED = {'staff', 'tba', 'tbd', 'to be announced', 'instructor tba'}
QUERY = 'query($id:ID!){node(id:$id){... on Teacher{legacyId firstName lastName avgRating avgDifficulty wouldTakeAgainPercent numRatings school{legacyId name}}}}'


def words(name):
    return re.findall(r'[a-z]+', unicodedata.normalize('NFKD', name).encode('ascii', 'ignore').decode().lower())


def load_profiles():
    """Ratings are optional when the shared identity snapshot is unavailable."""
    try:
        snapshot = json.loads(PROFILE_PATH.read_text(encoding='utf8'))
        if (isinstance(snapshot, dict) and snapshot.get('schoolId') == SCHOOL
                and isinstance(snapshot.get('profiles'), dict) and isinstance(snapshot.get('unresolved'), dict)):
            return snapshot
    except (ValueError, OSError):
        pass
    log.warning('Professor identity snapshot at %s is unavailable.', PROFILE_PATH)
    return {'profiles': {}, 'unresolved': {}}


class ProfessorRatings:
    def __init__(self, fetch=None, snapshot=None):
        self.fetch = fetch or self._fetch
        self.snapshot = snapshot if snapshot is not None else load_profiles()
        self.profiles_by_id = {p['id']: p for p in self.snapshot['profiles'].values()}
        self.cache = {}
        self.locks = {profile_id: RLock() for profile_id in self.profiles_by_id}

    def resolve_profile(self, name):
        profile = self.snapshot['profiles'].get(name)
        return profile if profile is not None else {'reason': self.snapshot['unresolved'].get(name, 'unmatched')}

    def _fetch(self, profile_id):
        # A small fixed lookup, kept off the shared review-search fetch budget.
        deadline = time.monotonic() + 6
        budget = active_budget.get()
        if budget:
            deadline = min(deadline, budget.deadline)
        payload = {'query': QUERY, 'variables': {'id': base64.b64encode(f'Teacher-{profile_id}'.encode()).decode()}}
        status, _, body = https_bytes('https://www.ratemyprofessors.com/graphql', deadline,
                                     body=json.dumps(payload).encode(), headers={'Content-Type': 'application/json'}, max_bytes=100000)
        if status != 200:
            raise ValueError('Rating source unavailable')
        result = json.loads(body)
        if result.get('errors'):
            raise ValueError('Invalid rating response')
        return result['data']['node']

    def _metrics(self, profile):
        profile_id = profile['id']
        # Calls for one profile share a refresh. Other instructors can load independently.
        with self.locks[profile_id]:
            cached = self.cache.get(profile_id)
            if cached and time.monotonic() - cached[0] < 900:
                return cached[1]
            raw = self.fetch(profile_id)
            if (raw.get('legacyId') != profile_id or raw.get('school', {}).get('legacyId') != 881
                    or words(raw.get('firstName', '') + ' ' + raw.get('lastName', '')) != words(profile['name'])):
                raise ValueError('Profile identity mismatch')
            count = raw.get('numRatings')
            if type(count) is not int or count < 0:
                raise ValueError('Invalid rating count')
            metrics = {'rating': None, 'difficulty': None, 'would_take_again_percent': None, 'review_count': count,
                       'fetched_at': datetime.now(timezone.utc).isoformat(), 'status': 'ok' if count else 'not_available'}
            if count:
                for source, target in [('avgRating', 'rating'), ('avgDifficulty', 'difficulty')]:
                    value = raw.get(source)
                    if isinstance(value, bool) or not isinstance(value, (float, int)) or not 1 <= value <= 5:
                        raise ValueError('Invalid metric')
                    metrics[target] = value
                percent = raw.get('wouldTakeAgainPercent')
                if type(percent) in (int, float) and 0 <= percent <= 100:
                    metrics['would_take_again_percent'] = percent
            else:
                metrics['reason'] = 'Profile has no ratings yet.'
            self.cache[profile_id] = (time.monotonic(), metrics)
            return metrics

    def section_metrics(self, profile_id):
        profile = self.profiles_by_id.get(profile_id)
        if profile is None:
            return None
        try:
            metrics = self._metrics(profile)
        except Exception:
            return {'status': 'unavailable'}
        return {'status': 'ok' if metrics['status'] == 'ok' else 'no_reviews',
                'rating': metrics['rating'], 'difficulty': metrics['difficulty'],
                'would_take_again_percent': metrics['would_take_again_percent'], 'fetched_at': metrics['fetched_at']}

    def lookup(self, names, *, enabled=True):
        result = []
        assigned = [n for n in dict.fromkeys(names) if isinstance(n, str) and n.strip().lower() not in UNASSIGNED]
        for name in assigned[:8]:
            row = {'name': name, 'rating': None, 'review_count': None, 'difficulty': None,
                   'scope': 'all courses', 'status': 'not_available'}
            if not enabled:
                result.append({**row, 'reason': 'Rate My Professors excluded by source preference.'})
                continue
            profile = self.resolve_profile(name)
            if 'reason' in profile:
                reason = 'Ambiguous SJSU profiles.' if profile['reason'] == 'ambiguous' else 'No matched SJSU profile.'
                result.append({**row, 'reason': reason})
                continue
            row.update(profile_id=profile['id'], profile_name=profile['name'],
                       source_url=f"https://www.ratemyprofessors.com/professor/{profile['id']}",
                       title=name + ' ratings')
            try:
                row.update({key: value for key, value in self._metrics(profile).items() if key != 'would_take_again_percent'})
            except Exception:
                row['reason'] = 'Rating source could not be verified.'
            result.append(row)
        return result


professor_ratings = ProfessorRatings()


def mentioned(name, text):
    """A professor counts as discussed when the answer names them; surnames are how answers usually refer to people."""
    surname = words(name)[-1:] if words(name) else []
    return bool(surname) and len(surname[0]) > 1 and surname[0] in words(text)


def rating_summary(evidence, about=None):
    """Code-written ratings table from ok evidence; values are copied, never generated.
    With `about` (the answer text), only professors the answer discusses get a row."""
    from .verifier import readable_date
    rows = {}
    for e in evidence:
        if e['status'] == 'ok':
            for row in e['data'].get('professor_ratings', []):
                if about is None or mentioned(row['name'], about):
                    rows.setdefault(row['name'], row)
    if not rows:
        return None

    def cell(value):
        return ' '.join(str(value).replace('|', '\\|').split())
    table = ['### Professor ratings', '', '| Professor | Rating | Difficulty | Reviews |', '| --- | --- | --- | --- |']
    for row in rows.values():
        available = row['status'] == 'ok'
        name = cell(row['name'])
        if row.get('source_url'):
            name = '[' + name + '](<' + row['source_url'] + '>)'
        count = row.get('review_count')
        table.append('| ' + ' | '.join([
            name,
            f"{row['rating']:.1f}/5" if available else 'Not available',
            f"{row['difficulty']:.1f}/5" if available else 'Not available',
            str(count) if type(count) is int else 'Not available']) + ' |')
    checked = sorted({readable_date(row['fetched_at']) for row in rows.values() if row.get('fetched_at')})
    note = ("Rate My Professors averages cover all of a professor's courses, not only this one. "
            'Higher difficulty means harder. These are student opinions, not grade guarantees.')
    if checked:
        note += ' Checked ' + ', '.join(checked) + '.'
    # Professor names link to their profiles; the answer footer carries the source chips.
    return '\n'.join([*table, '', '*' + note + '*'])


def with_rating_summary(rendered, evidence, follow_up=None, note=None):
    """Compose the answer with the code-written ratings table after the supporting facts."""
    from .verifier import compose
    if rating_summary(evidence):
        # Code owns the ratings table; drop a model-written duplicate (a table with a Rating/Difficulty column).
        rendered = [c for c in rendered if not ratings_table(c['text'])]
    # Rows only for professors the answer discusses: a course list does not need every instructor's ratings.
    summary = rating_summary(evidence, about='\n'.join(c['text'] for c in rendered))
    from .requirement_answer import requirement_table, requirement_table_block
    listing = requirement_table(evidence)
    if listing:
        # Code owns the complete requirement list; a model-written copy would duplicate or truncate it.
        rendered = [c for c in rendered if not requirement_table_block(c['text'])]
    extra = '\n\n'.join(block for block in (listing, summary) if block) or None
    return compose(rendered, evidence, follow_up, extra=extra, note=note)


def ratings_table(text):
    rows = [line.strip() for line in text.splitlines() if line.strip().startswith('|')]
    return len(rows) >= 2 and re.fullmatch(r'\|?[\s:|-]+\|?', rows[1]) is not None and re.search(r'\b(rating|difficulty)\b', rows[0], re.I) is not None
