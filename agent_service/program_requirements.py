"""Read-only program requirement lists from the Course Radar API, the same source the Planner uses."""
import os
import re
import time
from urllib.parse import urlsplit
import httpx

TECHNICAL = 'technical-electives'
_TECHNICAL_WORDS = re.compile(r'(?i)\b(?:tech(?:nical)?\.?\s*(?:upper[-\s]division\s+)?electives?|upper[-\s]division\s+technical\s+electives?)\b'
                              r'|tự\s*chọn\s*(?:kỹ\s*thuật|kĩ\s*thuật|chuyên\s*ngành)|môn\s*kỹ\s*thuật\s*tự\s*chọn')


def requirement_kind(area):
    """Program-specific requirements are not section attributes; recognise them before attribute matching."""
    return TECHNICAL if _TECHNICAL_WORDS.search(area or '') or re.fullmatch(r'\s*TEs?\s*', area or '', re.I) else None


_SCHOOL_TERM = re.compile(
    r'\b(?:GE\s+(?:Area\s+)?[1-6][ABC]?|(?:GE\s+)?(?:Area\s+)?[A-F][1-4](?!\w)'
    r'|(?:GE\s+(?:Area\s+)?|Area\s+)[A-F]|Area\s+[1-6][ABC]?'
    r'|US\s*1\s*[-–]\s*(?:US\s*)?3|US\s*[123]|American Institutions'
    r'|upper[- ]division (?:GE|general education)(?:\s+(?:area\s+)?[2345](?:/5)?)?|UD(?:\s*GE)?\s*[2345](?:/5)?'
    r'|graduation writing assessment requirement|writing in the disciplines|physical education|WID|GWAR|PE)\b',
    re.I,
)
_TERM = re.compile(r'\b(spring|summer|fall|winter)[\s-]+((?:19|20|21)\d{2})\b', re.I)
_YEAR = re.compile(r'\b(20\d{2})\s*[-–]\s*(20\d{2})\b')
_SEATS = re.compile(r'\b(?:seats?\s+(?:left|open|available)|(?:open|remaining|available)\s+seats?|not\s+full|còn\s+(?:chỗ|ghế)|(?:chỗ|ghế)\s+trống)\b', re.I)
_OFFERED = re.compile(r'\b(?:offer(?:ed|ings?)|schedul(?:ed|e)|available|open sections?|mở|có lớp)\b', re.I)
_COMPLETION = re.compile(r'^(?:have i|did i|do i|am i|tôi đã|mình đã)\b.*\b(?:satisf\w*|complet\w*|fulfill\w*|meet|đáp ứng|hoàn thành)\b', re.I)


def requirement_question(question):
    """Route self-contained, read-only requirement lists without model guesses about term or seats."""
    raw = question.strip()
    if not re.match(r'^(?:which|what|list|show(?: me)?|have i|did i|do i|am i|môn|những môn|liệt kê|tôi đã|mình đã)\b', raw, re.I):
        return None
    if re.search(r'\b(?:recommend|best|easiest|easier|compare|professors?|add|drop|remove|enroll|move|đề xuất|so sánh|thêm|đăng ký)\b', raw, re.I):
        return None
    target = _SCHOOL_TERM.search(raw) or _TECHNICAL_WORDS.search(raw) or re.search(r'\brequired(?: major)? courses?\b', raw, re.I)
    choice = re.search(r'\b(?:count(?:s)? (?:toward|for)|satisf(?:y|ied|ies)|fulfill(?:ed|s)?|meet(?:s)?|đáp ứng)\s+(?:the )?(.+?)(?=\s+(?:in (?:spring|summer|fall|winter)|for my major|for the \d|kỳ|trong (?:spring|summer|fall|winter))\b|[?!.]|$)', raw, re.I)
    area = target[0] if target else choice[1].strip() if choice else None
    if not area or len(area) > 180 or not (target or re.search(r'\b(?:course|courses|count|requirement|môn|satisfied|completed)\b', raw, re.I)):
        return None
    term = _TERM.search(raw)
    year = _YEAR.search(raw)
    mode = 'completion' if _COMPLETION.search(raw) else 'seats' if _SEATS.search(raw) else 'offered' if term or _OFFERED.search(raw) else 'catalog'
    return {'area': area, 'term': '-'.join(g.lower() for g in term.groups()) if term else None,
            'catalog_year': '-'.join(year.groups()) if year else None, 'mode': mode}


def api_base():
    """COURSE_RADAR_API_URL, else the API that already verifies accounts (KIMI_AUTH_URL ends in /auth/me)."""
    value = os.getenv('COURSE_RADAR_API_URL') or re.sub(r'/auth/me/?$', '', os.getenv('KIMI_AUTH_URL') or '')
    parts = urlsplit(value)
    if not value or not (parts.scheme == 'https' or (parts.scheme == 'http' and parts.hostname in {'localhost', '127.0.0.1'})):
        raise RuntimeError('Program requirement API is not configured.')
    return value.rstrip('/')


def _slug(text):
    return re.sub(r'[^a-z0-9]+', '-', (text or '').lower()).strip('-')


def _degree_name(value):
    parts = _slug(value).split('-')
    degrees = {'ba', 'bs', 'bfa', 'bm', 'bsn', 'ma', 'ms', 'mfa', 'mba', 'phd'}
    if len(parts) > 1 and parts[0] in degrees:
        return '-'.join(parts[1:]), parts[0]
    if len(parts) > 1 and parts[-1] in degrees:
        return '-'.join(parts[:-1]), parts[-1]
    return '-'.join(parts), None


def _program_names(row):
    core, _ = _degree_name(row['title'])
    slug, _ = _degree_name(row['slug'])
    words = core.split('-')
    meaningful = [word for word in words if word not in {'and', 'in', 'of', 'the', 'concentration', 'major', 'program'}]
    names = {core, slug}
    if len(meaningful) >= 2:
        initial = ''.join(word[0] for word in meaningful)
        prefix = meaningful[0]
        tail = initial[1:]
        consonants = prefix[0] + re.sub('[aeiou]', '', prefix[1:])
        names.update({initial, prefix[:4], prefix[:4] + tail, consonants[:3] + tail})
    if 'concentration' in words:
        index = words.index('concentration')
        if index:
            names.add(words[index - 1])
    return {name for name in names if len(name) >= 2}


def refers_to_workspace_program(value):
    return bool(re.fullmatch(r'(?:(?:my|selected|current|this|the)[ -]+)*(?:major|program|degree)', (value or '').strip(), re.I))


def listing_rules(listing):
    """Yield each rule with its course metadata, including legacy flat responses."""
    for course in listing.get('courses', []):
        metadata = {key: value for key, value in course.items() if key != 'rules'}
        for rule in course.get('rules', [{}]):
            entry = {**metadata, **rule}
            for field in ('term', 'topic', 'condition'):
                if entry.get(field) == '':
                    entry[field] = None
            yield entry


def assistant_listing(listing):
    """Keep legacy roadmap/extraction heuristics out of assistant membership."""
    if not listing:
        return listing
    review = listing.get('verificationStatus')
    keys = (str(listing.get(key) or '').rsplit(':', 1)[-1] for key in ('requirement', 'requirementId'))
    if review == 'extracted' or (review is None and any(key.startswith(('catalog-choice-', 'choice-')) for key in keys)):
        text = (listing.get('rule') or {}).get('text')
        return {**listing, 'courses': [], 'excludedCodes': [], 'coverage': 'open',
                'status': 'open_rule' if text else 'no_source'}
    return listing


class ProgramRequirements:
    def __init__(self, base=None, ttl=600, client=None):
        self.base, self.ttl, self.client = base, ttl, client
        self.cache = {}

    def _get(self, path, params, cache=True):
        key = (path, tuple(sorted(params.items())))
        hit = self.cache.get(key)
        if cache and hit and hit[0] > time.monotonic():
            return hit[1]
        url = (self.base or api_base()) + path
        response = (self.client or httpx).get(url, params=params, timeout=10)
        if path == '/bootstrap/requirements' and response.status_code == 404:
            try:
                message = response.json().get('message')
            except (AttributeError, ValueError):
                message = None
            if message in ('Program not found', 'Requested program catalog was not found'):
                return None
        response.raise_for_status()
        value = response.json()
        if cache:
            self.cache[key] = (time.monotonic() + self.ttl, value)
        return value

    def programs(self):
        return self._get('/bootstrap/programs', {})['programs']

    def resolve(self, name):
        """Map a program the user named to one slug; ambiguous names return candidates instead of a guess."""
        wanted = _slug(name)
        rows = self.programs()
        exact = [p for p in rows if p['slug'] == wanted or _slug(p['title']) == wanted]
        core, degree = _degree_name(name)
        if degree and not exact:
            exact = [p for p in rows if _degree_name(p['title']) == (core, degree)]
        if len(exact) == 1:
            return exact[0]['slug'], []
        if degree:
            return None, [p['title'] for p in exact]
        aliases = [p for p in rows if p.get('kind', 'bachelor') == 'bachelor' and wanted in _program_names(p)]
        if len(aliases) == 1:
            return aliases[0]['slug'], []
        if aliases:
            return None, [p['title'] for p in aliases]
        words = set(wanted.split('-')) - {'bs', 'ba', 'major', 'program', 'degree', 'in', 'of', 'the'}
        bachelor = [p for p in rows if p.get('kind', 'bachelor') == 'bachelor' and words and words <= set(_slug(p['title']).split('-'))]
        if not bachelor and len(words) >= 2:
            bachelor = [p for p in rows if p.get('kind', 'bachelor') == 'bachelor' and all(
                any(token == word or len(word) >= 3 and token.startswith(word) for token in _degree_name(p['title'])[0].split('-'))
                for word in words)]
        if len(bachelor) == 1:
            return bachelor[0]['slug'], []
        return None, [p['title'] for p in (bachelor or exact)][:6]

    def named(self, text):
        slug, _ = ProgramRequirements.named_matches(self, text)
        return slug

    def named_matches(self, text):
        """Resolve the longest program reference supported by words or abbreviations in the question."""
        raw = text or ''
        lowered = ' ' + re.sub(r'\s+', ' ', raw.lower()) + ' '
        matches = []
        for p in self.programs():
            if p.get('kind', 'bachelor') != 'bachelor':
                continue
            for alias in _program_names(p):
                name = r'[\s-]+'.join(map(re.escape, alias.split('-')))
                if alias in {'me', 'it', 'as', 'or', 'no', 'am', 'us', 'we', 'to', 'in', 'at', 'on', 'is', 'my'} and not re.search(rf'\b{alias.upper()}\b', raw):
                    continue
                if re.search(rf'(?:\bfor (?:the )?|\b(?:majoring|major|is|am|are|i\'m|im) in (?:the )?|\bngành |\bchuyên ngành ){name}\b(?![\s,–-]+(?:ms|ma|mfa|mba|phd)\b)'
                             rf'|\b{name}(?: (?:majors?|program|students|degree|concentration)\b|[\'’]s )', lowered):
                    matches.append((len(alias), p))
        if not matches:
            return None, []
        best = max(length for length, _ in matches)
        candidates = {p['slug']: p['title'] for length, p in matches if length == best}
        return (next(iter(candidates)), []) if len(candidates) == 1 else (None, sorted(candidates.values()))

    def get(self, program, requirement=TECHNICAL):
        return assistant_listing(self._get('/bootstrap/requirements', {
            'program': program, 'requirement': requirement, 'view': 'assistant',
        }, cache=False))

    def menu(self, program, year):
        rows = self._get('/bootstrap/requirement-menu', {
            'program': program, 'catalogYear': year, 'view': 'assistant',
        }, cache=False)['requirements']
        return [row for row in rows if row.get('verificationStatus') != 'extracted'
                and (row.get('verificationStatus') or not row['id'].rsplit(':', 1)[-1].startswith(('catalog-choice-', 'choice-')))]

    def for_catalog(self, program, requirement, year):
        return assistant_listing(self._get('/bootstrap/requirements', {
            'program': program, 'requirement': requirement, 'catalogYear': year, 'view': 'assistant',
        }, cache=False))
