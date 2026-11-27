"""SJSU requirement vocabulary and validated, read-only query inputs."""
import json
import re
from pathlib import Path
from datetime import date
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


MENU = json.loads((Path(__file__).with_name('data') / 'sjsu-requirements.json').read_text(encoding='utf-8'))
CAMPUS = {row['id']: row for row in MENU['requirements']}
CATALOG_YEAR = MENU['catalog_year']
PROGRAM_IDS = ('technical-electives', 'required-courses')
MENU_PROMPT = '\n'.join(' | '.join([key, row['label'], *row['former_names'], *row['aliases']])
                        for key, row in CAMPUS.items()) + '\n' + (
    'Program requirements (program_list only, never requirements_all or requirements_any): a requirement of a major '
    '(for example its technical electives, major preparation, core or required courses) rather than a campus designation above. '
    'Put the requirement name exactly as the student wrote it, or a program list ID from list_requirements, in program_list; '
    'code checks it against that program\'s catalog requirement menu. A campus designation above is never a program list: '
    'for "US2 and US3" use requirements_all ["us2", "us3"] with program_list null, not both.')
Day = Literal['M', 'T', 'W', 'R', 'F', 'S', 'U']
CourseCode = Annotated[str, Field(pattern=r'^[A-Za-z]{2,8}[0-9]?\s*[0-9]{1,3}[A-Za-z]{0,3}$', max_length=16)]


def normalized_words(value):
    return re.sub(r'[^\w]+', ' ', (value or '').casefold()).strip()


def mentions_phrase(message, phrase):
    words = normalized_words(phrase)
    return bool(words and f' {words} ' in f' {normalized_words(message)} ')


def broad_group(message):
    if re.search(r'\b(?:american institutions|us\s*1\s*(?:[-–]|through|to)\s*(?:us\s*)?3|us\s*123)\b', message, re.I):
        return 'American Institutions', ['us1', 'us2', 'us3']
    if not campus_mentions(message) and re.search(r'\b(?:general education|ge)\b', message, re.I):
        return 'General Education', ['ge-1', 'ge-2', 'ge-3', 'ge-4', 'ge-5', 'ge-6']
    return None


def exact_campus_id(name):
    """Check a copied requirement name against the declared vocabulary."""
    def normalized(value):
        text = re.sub(r'[^a-z0-9]+', ' ', (value or '').casefold()).strip()
        return re.sub(r'^(?:the )?(?:(?:old|former|formerly|legacy) )?', '', text)

    target = normalized(name)
    if not target:
        return None
    matches = []
    for key, row in CAMPUS.items():
        short = row['label'].split(' - ', 1)[0]
        names = [key, row['label'], short, short.replace('GE Area ', 'Area '), *row['former_names'], *row['aliases']]
        if ' - ' in row['label']:
            names.append(row['label'].split(' - ', 1)[1])
        names += ['GE ' + alias for alias in row['former_names'] if alias.startswith('Area ')]
        if target in {normalized(alias) for alias in names}:
            matches.append(key)
    return matches[0] if len(matches) == 1 else None


def _campus_phrases(row):
    """Normalized names a student may use for a designation row."""
    label = row['label'].split(' - ', 1)[0].removeprefix('Legacy ')
    names = [label, *row['former_names'], *row['aliases']]
    names += [re.sub(r'(?<=[a-z])(?=[A-Z])', ' ', alias) for alias in row['aliases']]
    names += [re.sub(r'(?<=[A-Z])(?=\d)', ' ', name) for name in names if re.search(r'[A-Z]\d', name)]
    if ' - ' in row['label']:
        names.append(row['label'].split(' - ', 1)[1])
    if label.startswith('GE Area '):
        names += [label.replace('GE Area ', 'GE '), label.removeprefix('GE ')]
    return {phrase for name in names if (phrase := re.sub(r'[^a-z0-9]+', ' ', name.casefold()).strip())}


def campus_phrase(message, key):
    """The student's own wording for one designation, such as "GE E" for ge-e, or None when the message does not name it."""
    text = ' ' + re.sub(r'[^a-z0-9]+', ' ', (message or '').casefold()).strip() + ' '
    said = [phrase for phrase in _campus_phrases(CAMPUS[key]) if f' {phrase} ' in text] if key in CAMPUS else []
    if not said:
        return None
    words = max(said, key=len).split()
    match = re.search(r'(?<![a-z0-9])' + r'[^a-z0-9]+'.join(map(re.escape, words)) + r'(?![a-z0-9])', message, re.I)
    return match[0] if match else ' '.join(words)


def campus_mentions(message):
    """Recognize verbatim designation names from the menu, preserving ambiguity."""
    text = ' ' + re.sub(r'[^a-z0-9]+', ' ', message.casefold()).strip() + ' '
    hits = {}
    for key, row in CAMPUS.items():
        for phrase in _campus_phrases(row):
            if f' {phrase} ' in text:
                hits.setdefault(key, set()).add(phrase)
    return sorted(key for key, names in hits.items() if any(
        not any(name != other and f' {name} ' in f' {other} '
                for other_key, phrases in hits.items() if other_key != key for other in phrases)
        for name in names))


def campus_selectors(name, question=''):
    """Campus selectors for a requirement phrase that names designations, such as "US2 and US3"; None otherwise."""
    exact = exact_campus_id(name)
    if exact:
        return {'requirements_all': [exact]}
    ids = campus_mentions(name or '')
    if len(ids) > 1 and re.search(r'\b(?:or|either)\b', f'{name} {question}', re.I):
        return {'requirements_any': ids}
    return {'requirements_all': ids} if ids else None


def campus_effect_id(message):
    matches = campus_mentions(message)
    if len(matches) == 1:
        return matches[0]
    if not matches:
        matches = [key for key, row in CAMPUS.items()
                   if (suffix := re.search(r'\bArea\s+(\d+[A-Z]?)$', row['label'].split(' - ', 1)[0]))
                   and mentions_phrase(message, suffix[1]) and not re.fullmatch(r'\d+', suffix[1])]
        if len(matches) == 1:
            return matches[0]
    return None


MAJOR_EFFECT_QUESTION = re.compile(r'\b(?:waived?|waives|waiver|exempt(?:ion|ed)?|covered|covers?|satisf(?:y|ies|ied) by (?:my |the |this )?major'
                                   r'|(?:my|the|this) major (?:covers?|satisf(?:y|ies)|takes care of)'
                                   r'|(?:need|take|require\w*)\b.{0,90}\bfor (?:my|the|this) major'
                                   r'|(?:still need|separate)\b)\b', re.I)
_UNITS_SUFFIX = re.compile(r'\s*\(\d+(?:\.\d+)?\s*units?\)\s*$', re.I)
_MENU_STOP = {'the', 'a', 'an', 'for', 'my', 'what', 'which', 'course', 'courses', 'class', 'classes', 'requirement',
              'requirements', 'count', 'counts', 'list', 'show', 'me', 'do', 'does', 'i', 'need', 'to', 'of', 'in',
              'and', 'or', 'is', 'are', 'can', 'take', 'major', 'program', 'degree'}


def menu_key(row):
    return str(row.get('id') or '').rsplit(':', 1)[-1]


def menu_names(row):
    """Every name a menu row is published under: label, label without unit counts, key and sourced aliases."""
    label = row.get('label') or ''
    plain = re.sub(r'^\d+\.\s*', '', _UNITS_SUFFIX.sub('', label))
    names = [label, plain, plain.split(' - ', 1)[0], menu_key(row).replace('-', ' ')]
    names += [_UNITS_SUFFIX.sub('', alias.get('text') or '') for alias in row.get('aliases', [])]
    return {words for words in map(normalized_words, names) if words}


def menu_mentions(message, rows):
    """Menu rows the student's own words name; when one matched name contains another, the longer name wins."""
    from .program_requirements import TECHNICAL, requirement_kind
    def singular(words):
        return ' '.join(w[:-1] if len(w) > 3 and w.endswith('s') and not w.endswith('ss') else w for w in words.split())
    text = f' {singular(normalized_words(message))} '
    best = {}
    for row in rows:
        hits = [name for name in menu_names(row) if f' {singular(name)} ' in text]
        if menu_key(row) == TECHNICAL and requirement_kind(message):
            hits.append('technical electives')
        if hits:
            best[row['id']] = max(hits, key=len)
    return [row for row in rows if row['id'] in best and not any(
        other != best[row['id']] and f' {best[row["id"]]} ' in f' {other} ' for other in best.values())]


def closest_menu(message, rows, limit=5):
    words = set(normalized_words(message).split()) - _MENU_STOP
    scored = [(len(words & set(' '.join(menu_names(row)).split())), index, row) for index, row in enumerate(rows)]
    # No overlap means no closest entry; listing the menu's first rows would present unrelated requirements as matches.
    return [row for score, _, row in sorted(scored, key=lambda item: (-item[0], item[1])) if score][:limit]


def select_program_requirement(value, messages, rows):
    """Bind a proposed program requirement to one menu row the student's words support.

    Returns (row, None) or (None, (outcome, candidate_rows)). Without student wording (internal callers) the proposed
    value must name exactly one row by itself."""
    rows = [row for row in rows if row.get('scope', 'program') == 'program']
    value = value or ''
    wanted = normalized_words(value)
    chosen = [row for row in rows if value in (row.get('id'), menu_key(row)) or wanted in menu_names(row)] or menu_mentions(value, rows)
    for message in [m for m in messages if m and m.strip()]:
        said = menu_mentions(message, rows)
        if len(said) == 1:
            return said[0], None
        if said:
            return None, ('ambiguous_requirement', said)
        if value and mentions_phrase(message, value):
            matches = related_program_requirements(value, rows)
            if len(matches) == 1:
                return matches[0], None
            if matches:
                return None, ('ambiguous_requirement', matches)
    if not any(m and m.strip() for m in messages) and len(chosen) == 1:
        return chosen[0], None
    candidates = closest_menu(' '.join([*messages[:1], value]), rows)
    if len(candidates) == 1:
        return candidates[0], None
    return None, ('unknown_requirement', candidates)


CONDITION_TOPICS = {
    'gpa': r'\b(?:gpa|grade.point average|minimum grade)\b',
    'approval': r'\b(?:approv\w*|permission|consent|petition)\b',
    'units': r'\b(?:units?|credits?)\b',
    'substitution': r'\b(?:substitut\w*|replac\w*|instead|in lieu)\b',
    'exclusion': r'\b(?:exclu\w*|ineligible|not (?:count|eligible|allowed)|non.required)\b',
}


def condition_topics(question):
    return {key for key, pattern in CONDITION_TOPICS.items() if re.search(pattern, question, re.I)}


def related_program_requirements(value, rows):
    def keywords(text):
        words = normalized_words(text).split()
        equivalents = {'div': 'division', 'prep': 'preparation', 'foundational': 'foundation'}
        return {equivalents.get(word, word.removesuffix('s') if word.endswith('s') and len(word) > 3 else word)
                for word in words if word not in _MENU_STOP and word not in {'unit', 'units'} and not word.isdecimal()}
    wanted = keywords(value)
    if not wanted:
        return []
    candidates = [(row, [keywords(name) for name in menu_names(row)]) for row in rows]
    exact = [row for row, names in candidates if wanted in names]
    if exact:
        return exact
    return [row for row, names in candidates if any(
        name and (wanted <= name or (len(name) >= 2 and name <= wanted)) for name in names)]


def campus_selector_error(query, question):
    """A proposed section predicate must preserve the scope of the user's designations."""
    requested = set(campus_mentions(question))
    selected_all, selected_any = set(query.requirements_all), set(query.requirements_any)
    selected = selected_all | selected_any
    if selected != requested:
        return 'The proposed requirement selectors do not match the designations in your question.'
    if len(requested) < 2:
        return None
    words = normalized_words(question)
    uses_or = bool(re.search(r'\b(?:or|either|hoặc)\b', words))
    uses_and = bool(re.search(r'\b(?:and|both|và|cả)\b', words))
    if (uses_or and uses_and) or not (uses_or or uses_and):
        return 'Please clarify how these requirements should be combined.'
    if uses_or and selected_all or uses_and and selected_any:
        return 'The proposed requirement grouping does not match your question.'
    return None


_SEASON = r'(winter|spring|sprng|summer|fall)'
_TERM_WORDS = re.compile(rf"\b{_SEASON}(?:\s+semester)?[\s-]+['’]?(\d{{2}}|\d{{4}})\b", re.I)
_RELATIVE_TERM = re.compile(rf"\b(?:next|this coming|coming|this)\s+{_SEASON}\b", re.I)


def question_terms(question, today: date):
    def season(word):
        return word.casefold().replace('sprng', 'spring')

    explicit = {f"{season(match[1])}-{int(match[2]) + (2000 if len(match[2]) == 2 else 0)}"
                for match in _TERM_WORDS.finditer(question)}
    for match in _RELATIVE_TERM.finditer(question):
        if _TERM_WORDS.match(question, match.start(1)):
            continue
        name = season(match[1])
        month = {'winter': 1, 'spring': 1, 'summer': 6, 'fall': 8}[name]
        explicit.add(f'{name}-{today.year + (today.month >= month)}')
    return explicit


class RequirementFilters(BaseModel):
    model_config = ConfigDict(extra='forbid')

    requirements_all: list[str] = Field(default_factory=list, max_length=25, description='Campus requirement IDs all satisfied by the same section.')
    requirements_any: list[str] = Field(default_factory=list, max_length=25, description='Campus requirement IDs of which the same section must satisfy at least one.')
    program_list: str | None = Field(default=None, max_length=200, description='Stable program list ID from list_requirements; combined with campus criteria by intersection.')
    open_seats_only: bool = False
    modes: list[Literal['Fully Online', 'Hybrid', 'In Person']] = Field(default_factory=list, max_length=3)
    days: list[Day] = Field(default_factory=list, max_length=7, description='Allowed meeting days. Every meeting must fit these days.')
    required_days: list[Day] = Field(default_factory=list, max_length=7, description='Meeting days that must be present.')
    exclude_days: list[Day] = Field(default_factory=list, max_length=7, description='Days on which the section must never meet.')
    starts_at_or_after: str | None = Field(default=None, pattern=r'^(?:[01][0-9]|2[0-3]):[0-5][0-9]$')
    ends_by: str | None = Field(default=None, pattern=r'^(?:[01][0-9]|2[0-3]):[0-5][0-9]$')
    courses: list[CourseCode] = Field(default_factory=list, max_length=30, description='Exact public course codes, when requested.')

    @model_validator(mode='after')
    def validate_filters(self):
        if self.starts_at_or_after and self.ends_by and self.starts_at_or_after >= self.ends_by:
            raise ValueError('The start bound must precede the end bound.')
        if (set(self.days) | set(self.required_days)) & set(self.exclude_days):
            raise ValueError('Allowed and excluded meeting days must be disjoint.')
        return self

    def normalized_ids(self):
        """Place an unambiguous program-only ID in its program filter."""
        ids = set(self.requirements_all + self.requirements_any)
        if not self.program_list and len(ids) == 1 and ids <= set(PROGRAM_IDS):
            return self.model_copy(update={'program_list': next(iter(ids)), 'requirements_all': [], 'requirements_any': []})
        return self


class SectionSearch(RequirementFilters):
    term: str | None = Field(default=None, pattern=r'^(fall|spring|winter|summer)-(19|20|21)\d{2}$')
    program: str | None = Field(default=None, max_length=120)
    catalog_year: str | None = Field(default=None, pattern=r'^20\d{2}-20\d{2}$')
    completion: bool = False


def bind_section_scope(query, question, rows, *, scope_required=False):
    """Bind a proposed query to the question before touching section data."""
    campus = campus_mentions(question)
    groups = broad_group(question)
    program_rows = [row for row in rows if row.get('scope', 'program') == 'program']
    if not campus and rows:
        sourced = menu_mentions(question, [row for row in rows if row.get('scope') == 'campus'])
        if sourced:
            known = {exact_campus_id(row['label']) or exact_campus_id(row['label'].split(' - ', 1)[0]) for row in sourced}
            if len(known - {None}) == 1:
                campus = sorted(known - {None})
    if campus:
        joined = {key for key, row in CAMPUS.items()
                  if (suffix := re.search(r'\bArea\s+(\d+[A-Z])$', row['label'].split(' - ', 1)[0]))
                  and re.search(rf'\b(?:and|or|both|either)\s+{re.escape(suffix[1])}\b', question, re.I)}
        campus = sorted(set(campus) | joined)
    if not campus and groups and groups[0] == 'American Institutions':
        campus = groups[1]
    if campus:
        if len(campus) == 1:
            query = query.model_copy(update={'requirements_all': campus, 'requirements_any': []})
        elif groups and campus == groups[1] or re.search(r'\b(?:either|or)\b', question, re.I):
            query = query.model_copy(update={'requirements_all': [], 'requirements_any': campus})
        elif re.search(r'\b(?:both|and|together)\b', question, re.I):
            query = query.model_copy(update={'requirements_all': campus, 'requirements_any': []})
        error = (campus_selector_error(query, question)
                 if campus == campus_mentions(question) and not (groups and campus == groups[1]) else None)
        if error:
            return query, ('ambiguous_requirement', [])
    if program_rows:
        choice, issue = select_program_requirement(query.program_list, [question], program_rows)
        proposed = set(campus_mentions(query.program_list or '')) | {exact_campus_id(query.program_list)} - {None}
        if choice:
            query = query.model_copy(update={'program_list': choice['id']})
        elif query.program_list and campus and ((proposed and proposed <= set(campus)) or
                (len(campus) == 1 and mentions_phrase(question, query.program_list))):
            # Campus designations proposed as a program list are checked as the designations the question names.
            query = query.model_copy(update={'program_list': None})
        elif query.program_list or issue[0] == 'ambiguous_requirement':
            return query, issue
    if scope_required and not (query.program_list or query.requirements_all or query.requirements_any):
        return query, ('unknown_requirement', closest_menu(question, program_rows))
    return query, None


def bind_schedule_filters(query, question):
    """Preserve explicit mode, seat and meeting-day constraints on the same section."""
    words = normalized_words(question)
    updates = {}
    modes = [mode for mode, pattern in (
        ('Fully Online', r'\b(?:fully online|online only|exclusively online)\b'),
        ('In Person', r'\b(?:in person|face to face|on campus)\b'),
        ('Hybrid', r'\bhybrid\b'),
    ) if re.search(pattern, words)]
    if modes and not re.search(r'\b(?:not|no|exclude)\b', words):
        updates['modes'] = modes
    if re.search(r'\b(?:(?:open|remaining|available) seats?|seats? (?:left|open|available)|still have seats?|not full)\b', words):
        updates['open_seats_only'] = True
    days = [code for name, code in zip(('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'), 'MTWRFSU')
            if re.search(rf'\b{name}s?\b', words)]
    if days and not query.exclude_days and not re.search(r'\b(?:avoid|except|without|not on|no|exclude)\b', words):
        if not re.search(r'\b(?:or|either)\b', words):
            updates['required_days'] = days
        if (query.days and len(days) > 1) or re.search(r'\b(?:only|limited to)\b', words):
            updates['days'] = days
        elif len(days) == 1:
            updates['days'] = []
    return SectionSearch.model_validate({**query.model_dump(), **updates})
