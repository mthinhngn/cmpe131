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
             'find_courses_by_requirement': 'Requirement candidates', 'check_fit': 'Course fit'}.get(tool, 'Requested information')
    gap = (f'{label} could not be verified because the lookup failed.' if status == 'failed' else
           f'{label} were not available from this lookup.' if status == 'empty' else None)
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


def compact(value, limit=6000):
    """Bound the model view while retaining complete observations for verification."""
    encoded = json.dumps(value, ensure_ascii=False, default=str)
    if len(encoded) <= limit:
        return encoded
    return json.dumps({'evidence_id': value['evidence_id'], 'status': value['status'],
                       'source': value['source'], 'truncated': True,
                       'data_excerpt': encoded[:limit - 600]}, ensure_ascii=False)
