"""Typed observations; identifiers and source metadata belong to code."""
import json
from urllib.parse import urlsplit
from contextvars import ContextVar
from datetime import datetime, timezone
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field

progress_callback = ContextVar('advisor_progress', default=None)


def report_progress(node, detail):
    callback = progress_callback.get()
    if callback:
        callback({'node': node, 'detail': detail})


class Source(BaseModel):
    model_config = ConfigDict(extra='forbid')
    kind: Literal['database', 'official_web', 'public_web', 'transcript', 'browser']
    url: str | None = None
    fetched_at: str | None = None


class Evidence(BaseModel):
    model_config = ConfigDict(extra='forbid')
    evidence_id: str
    tool: str
    status: Literal['ok', 'empty', 'failed']
    source: Source
    data: dict = Field(default_factory=dict)
    error: str | None = None
    gap_statement: str | None = None


def envelope(index, tool, data, *, kind='database', status='ok', error=None):
    label = {'get_sections': 'Section details', 'get_transcript_facts': 'Confirmed transcript facts',
             'review_research': 'Instructor reviews', 'course_reviews': 'Student course reviews', 'search_catalog': 'Catalog search results',
             'official_lookup': 'Official information', 'course_research': 'Official course research', 'get_course': 'Course details',
             'find_courses_by_requirement': 'Requirement candidates', 'search_sections': 'Matching sections',
             'course_facts': 'Catalog and schedule facts', 'check_fit': 'Course fit'}.get(tool, 'Requested information')
    gap = (f'{label} could not be verified because the lookup failed.' if status == 'failed' else
           # Requirement lookups distinguish no list, no schedule and no offering; keep that code-written reason.
           (data.get('gap') if isinstance(data.get('gap'), str) else f'{label} were not available from this lookup.') if status == 'empty' else None)
    return Evidence(evidence_id=f'ev_{index}', tool=tool, status=status,
                    source=Source(kind=kind, url=data.get('source_url') or data.get('sourceUrl'),
                                  fetched_at=data.get('fetched_at') or data.get('fetchedAt') or
                                  (datetime.now(timezone.utc).isoformat() if kind == 'browser' else None)),
                    data=data, error=error, gap_statement=gap).model_dump()


def citations_for(evidence):
    """Keep each public result's URL and timestamp, including batched/RAG reads."""
    if evidence['status'] != 'ok' or evidence['source']['kind'] in {'transcript', 'browser'}:
        return []
    result, seen = [], set()

    def add(row):
        url = row.get('url') or row.get('catalog_url') or row.get('source_url') or row.get('sourceUrl')
        if not isinstance(url, str):
            return
        parsed = urlsplit(url)
        if parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password or url in seen:
            return
        seen.add(url)
        result.append({'evidence_id': evidence['evidence_id'], 'url': url,
                       'title': row.get('title') or row.get('code') or evidence['tool'].replace('_', ' ').title(),
                       'fetched_at': row.get('fetched_at') or row.get('fetchedAt') or row.get('retrieved_at')})

    def visit(row):
        if not isinstance(row, dict):
            return
        add(row)
        for key in ('courses', 'results', 'sources', 'citations', 'instructors'):
            for child in row.get(key, []):
                visit(child)

    visit(evidence['data'])
    add(evidence['source'])
    return result


def requirement_view(value):
    """Compact presentation for the model; the evidence ledger remains authoritative."""
    data = value['data']
    def section(s):
        seats = s['open_seats'] if s['seats_known'] else 'unknown'
        return f"{s['section']} #{s['class_number']}: {seats} open seats"
    keep = {k: data[k] for k in ('term', 'requirement', 'requirement_id', 'label', 'program', 'program_name', 'catalog_year',
                                 'mode', 'outcome', 'open_only', 'listed_count', 'coverage', 'rule', 'gap', 'candidates',
                                 'completion', 'sourceUpdatedOn', 'query', 'verification', 'record_status', 'rule_quote',
                                 'exclusions', 'conflicts', 'queried_courses') if k in data}
    if 'verification' in data:
        keep['attribution'] = ("Code-checked catalog record: attribute it as \"SJSU's catalog lists ...\" with the rule quote and source; "
                               'never call it verified or advisor-approved. Where conflicts exist, state every alternative or none.')
    keep['rule_sources'] = [{'url': s['url'], 'checked_on': s.get('checked_on')} for s in data.get('sources', [])]
    keep['courses'] = [{'code': c['code'], 'title': c.get('title'), 'units': c.get('units'), 'condition': c.get('condition'),
                        'sections': [section(s) for s in c.get('sections', [])]} for c in data.get('courses', [])]
    keep['display'] = 'Code appends the complete course and section table after your text.'
    return {'evidence_id': value['evidence_id'], 'status': value['status'], 'tool': value['tool'], 'source': value['source'], 'data': keep}


def compact(value, limit=6000):
    """Bound the model view while retaining complete observations for verification."""
    if value.get('tool') in ('find_courses_by_requirement', 'search_sections') and value.get('data', {}).get('requirement'):
        view = requirement_view(value)
        encoded = json.dumps(view, ensure_ascii=False, default=str)
        if len(encoded) <= limit:
            return encoded
        data = view['data']
        summary = {key: data[key] for key in ('requirement_id', 'mode', 'outcome', 'coverage', 'term', 'listed_count') if key in data}
        summary.update(course_count=len(data['courses']), display='The full verified list is appended by code. Do not reconstruct it.')
        return json.dumps({'evidence_id': view['evidence_id'], 'tool': view['tool'], 'status': view['status'],
                           'truncated': True, 'data': summary}, ensure_ascii=False)
    encoded = json.dumps(value, ensure_ascii=False, default=str)
    if len(encoded) <= limit:
        return encoded
    return json.dumps({'evidence_id': value['evidence_id'], 'status': value['status'],
                       'source': value['source'], 'truncated': True,
                       'data_excerpt': encoded[:limit - 600]}, ensure_ascii=False)
