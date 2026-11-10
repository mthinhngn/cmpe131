"""Bounded public research. Search extracts are evidence, never instructions."""
import json
import os
import time
from urllib.parse import urlsplit
from .kimi_budget import charge
from .web_tools import https_bytes, LookupFailure


class ResearchAgent:
    def __init__(self, search=None):
        self.search = search or self._search

    def _search(self, query, deadline):
        key = os.getenv('TAVILY_API_KEY')
        if not key:
            raise LookupFailure('missing_search_key', 'Public research is not configured.')
        deadline = charge('searches', deadline)
        body = json.dumps({'query': query, 'max_results': 4, 'search_depth': 'basic', 'include_answer': False, 'include_raw_content': False}).encode()
        status, _, raw = https_bytes('https://api.tavily.com/search', deadline, body=body,
                                    headers={'Authorization': f'Bearer {key}', 'Content-Type': 'application/json'}, max_bytes=500000)
        if status != 200:
            raise LookupFailure('search_failed', 'Public research failed. No automatic retry was made.')
        return json.loads(raw).get('results', [])

    def invoke(self, queries):
        if not 1 <= len(queries) <= 3:
            raise ValueError('Research requires one to three public queries')
        sources, seen = [], set()
        for query in queries:
            for row in self.search(query, time.monotonic() + 30):
                url = str(row.get('url', ''))
                p = urlsplit(url)
                if p.scheme != 'https' or not p.hostname or p.username or p.password or url in seen:
                    continue
                seen.add(url)
                sources.append({'source_id': str(len(sources) + 1), 'url': url, 'title': str(row.get('title', ''))[:250],
                                # Keep the routing + evidence + answer calls within a small
                                # provider token allowance; these are snippets, not full pages.
                                'excerpt': str(row.get('content', ''))[:1000], 'evidence_type': 'search_extract'})
                if len(sources) == 6:
                    break
            if len(sources) == 6:
                break
        return {'status': 'completed' if sources else 'failed', 'sources': sources,
                'coverage': 'Public search extracts only; inaccessible pages and missing reviews are not verified. Reviews are opinions, not official academic facts.'}
