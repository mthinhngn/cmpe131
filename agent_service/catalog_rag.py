"""LlamaIndex retrieval over public catalog facts; never used for seat counts."""
import os
import re
from urllib.parse import urlsplit

import psycopg
from psycopg.rows import dict_row

from .catalog import database_url


def embedding_model():
    from llama_index.embeddings.openai import OpenAIEmbedding
    return OpenAIEmbedding(model='text-embedding-3-small', dimensions=1536,
                           api_key=os.environ['OPENAI_API_KEY'], max_retries=0, timeout=35)


def vector_store(table, setup=False):
    if table not in {'kimi_catalog', 'kimi_transcripts'}:
        raise ValueError('Unknown vector collection')
    from llama_index.vector_stores.postgres import PGVectorStore
    from sqlalchemy.engine import make_url
    url = make_url(database_url())
    # asyncpg spells libpq's sslmode as ssl (hosted Postgres such as Neon requires it).
    query = {('ssl' if k == 'sslmode' else k): v for k, v in url.query.items() if k != 'channel_binding'}
    return PGVectorStore.from_params(
        connection_string=url.set(drivername='postgresql+psycopg2').render_as_string(hide_password=False),
        async_connection_string=url.set(drivername='postgresql+asyncpg', query=query).render_as_string(hide_password=False),
        table_name=table, embed_dim=1536, use_jsonb=True, perform_setup=setup)


def retrieval_index(table, setup=False):
    from llama_index.core import VectorStoreIndex
    return VectorStoreIndex.from_vector_store(vector_store(table, setup), embed_model=embedding_model())


def catalog_nodes(rows, policies=()):
    from llama_index.core.schema import TextNode
    from llama_index.core.node_parser import SentenceSplitter
    nodes = []
    for row in rows:
        code = row['code']
        metadata = {'code': code, 'title': row['title'], 'catalog_url': row['catalog_url'],
                    'subject': code.split()[0], 'satisfies': row.get('satisfies', []),
                    'term_offered': row.get('term_offered', []), 'units': row.get('units'),
                    'kind': 'course', 'fetched_at': str(row.get('fetched_at', ''))}
        # Empty metadata is omitted because vector backends require concrete scalar/list values.
        metadata = {k: v for k, v in metadata.items() if v is not None}
        text = '\n'.join(str(x) for x in [code + ' ' + row['title'], row.get('description'),
                                          row.get('prerequisite_text')] if x)
        nodes.append(TextNode(id_='catalog:' + row['course_id'], text=text, metadata=metadata))
    splitter = SentenceSplitter(chunk_size=512, chunk_overlap=64)
    for page in policies:
        from .web_tools import official_url
        url = official_url(page['url'])
        for number, chunk in enumerate(splitter.split_text(page['text'])):
            nodes.append(TextNode(id_=f'policy:{url}:{number}', text=chunk,
                                  metadata={'kind': 'policy', 'catalog_url': url,
                                            'title': page['title'], 'fetched_at': page['retrieved_at']}))
    return nodes


def catalog_rows():
    from .availability import parse_satisfies
    with psycopg.connect(database_url(), connect_timeout=5, row_factory=dict_row,
                         options='-c default_transaction_read_only=on -c statement_timeout=10000') as connection:
        rows = [dict(r) for r in connection.execute('''
            SELECT c.id AS course_id,c.code,r.title,r.units,r.description,
                   r."prerequisiteText" AS prerequisite_text,r."sourceUrl" AS catalog_url,
                   r."fetchedAt" AS fetched_at
            FROM "UniversityCourseRecord" r JOIN "Course" c ON c.id=r."courseId"
            WHERE r."catalogYear"='2026-2027' ORDER BY c.code''').fetchall()]
        sections = connection.execute('''SELECT "courseId" AS course_id,"termId" AS term,
            evidence->>'attributes' AS attributes FROM "UniversitySectionRecord"''').fetchall()
    by_id = {r['course_id']: r for r in rows}
    for section in sections:
        if section['course_id'] not in by_id:
            continue
        row = by_id[section['course_id']]
        row['satisfies'] = sorted(set(row.get('satisfies', [])) | set(parse_satisfies(section['attributes'] or '')))
        row['term_offered'] = sorted(set(row.get('term_offered', [])) | {section['term']})
    return rows


def metadata_filters(values):
    from llama_index.core.vector_stores import MetadataFilter, MetadataFilters, FilterOperator
    allowed = {'subject', 'satisfies', 'term_offered', 'units'}
    if not isinstance(values, dict) or set(values) - allowed:
        raise ValueError('Unsupported catalog filters')
    filters = []
    for key, value in values.items():
        if key == 'units':
            if isinstance(value, bool) or not isinstance(value, (int, float)) or not 0 <= value <= 30:
                raise ValueError('Invalid units filter')
        elif not isinstance(value, str) or not re.fullmatch(r'[A-Za-z0-9 ()/+_.-]{1,80}', value):
            raise ValueError('Invalid catalog filter')
        filters.append(MetadataFilter(key=key, value=value,
                                      operator=FilterOperator.CONTAINS if key in {'satisfies', 'term_offered'} else FilterOperator.EQ))
    return MetadataFilters(filters=filters)


class CatalogRAG:
    def __init__(self, index=None, minimum_score=0.35):
        self.index = index
        self.minimum_score = minimum_score

    def search(self, query, filters=None):
        if not isinstance(query, str) or not 1 <= len(query.strip()) <= 1500:
            raise ValueError('Enter a catalog question of at most 1500 characters')
        selected = metadata_filters(filters or {})
        index = self.index if self.index is not None else retrieval_index('kimi_catalog')
        hits = index.as_retriever(similarity_top_k=8, filters=selected).retrieve(query)
        results = []
        for hit in hits:
            if hit.score is None or hit.score < self.minimum_score:
                continue
            meta = hit.node.metadata
            url = meta.get('catalog_url', '')
            host = (urlsplit(url).hostname or '').lower()
            if not (host == 'sjsu.edu' or host.endswith('.sjsu.edu')):
                continue
            results.append({'code': meta.get('code'), 'title': meta.get('title'),
                            'snippet': hit.node.get_content()[:1400], 'score': hit.score,
                            'catalog_url': url, 'fetched_at': meta.get('fetched_at')})
        return {'results': results, 'coverage': 'Catalog relevance only; schedules and seats require availability tools.'}
