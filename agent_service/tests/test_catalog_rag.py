import unittest
import os
from uuid import uuid4
from unittest.mock import Mock, patch

from agent_service.catalog_rag import CatalogRAG, catalog_nodes, metadata_filters, vector_store
from agent_service.transcripts import TranscriptIndex


class CatalogRAGTests(unittest.TestCase):
    @unittest.skipUnless(os.getenv('KIMI_TEST_POSTGRES') == '1', 'optional pgvector integration')
    def test_pgvector_filters_and_delete_without_paid_embeddings(self):
        from llama_index.core.schema import TextNode
        from llama_index.core.vector_stores import MetadataFilter, MetadataFilters, VectorStoreQuery
        store = vector_store('kimi_transcripts')
        document = 'test-' + str(uuid4())
        owner = 'account:test-' + str(uuid4())
        node = TextNode(id_=document, ref_doc_id=document, text='Fixture transcript',
                        metadata={'owner': owner, 'document_id': document}, embedding=[1.0] + [0.0] * 1535)
        try:
            store.add([node])
            def query(value):
                return store.query(VectorStoreQuery(query_embedding=node.embedding, similarity_top_k=2,
                    filters=MetadataFilters(filters=[MetadataFilter(key='owner', value=value)]))).nodes
            self.assertEqual([n.node_id for n in query(owner)], [document])
            self.assertEqual(query(owner + '-other'), [])
        finally:
            store.delete_nodes([document])
        self.assertEqual(store.get_nodes(node_ids=[document]), [])

    def test_ten_fixture_queries_through_real_llamaindex_retrieval(self):
        from llama_index.core import VectorStoreIndex
        from llama_index.core.embeddings import BaseEmbedding
        vocabulary = ['calculus', 'derivatives', 'history', 'american', 'circuits', 'voltage', 'python',
                      'programming', 'psychology', 'behavior', 'chemistry', 'molecules']

        class FixtureEmbedding(BaseEmbedding):
            def _get_query_embedding(self, query):
                return [float(word in query.lower()) for word in vocabulary]

            async def _aget_query_embedding(self, query):
                return self._get_query_embedding(query)

            def _get_text_embedding(self, text):
                return self._get_query_embedding(text)

        specs = [('MATH 30', 'Calculus derivatives'), ('HIST 15', 'American history'),
                 ('EE 98', 'Circuits voltage'), ('CS 22A', 'Python programming'),
                 ('PSYC 1', 'Psychology behavior'), ('CHEM 1A', 'Chemistry molecules')]
        rows = [{'course_id': code, 'code': code, 'title': description, 'description': description,
                 'catalog_url': 'https://catalog.sjsu.edu/course/' + code.replace(' ', '')} for code, description in specs]
        index = VectorStoreIndex(catalog_nodes(rows), embed_model=FixtureEmbedding())
        rag = CatalogRAG(index=index)
        for query, expected in [('calculus', 'MATH 30'), ('derivatives', 'MATH 30'),
                                ('american history', 'HIST 15'), ('history', 'HIST 15'),
                                ('circuits', 'EE 98'), ('voltage', 'EE 98'),
                                ('python', 'CS 22A'), ('programming', 'CS 22A'),
                                ('psychology behavior', 'PSYC 1'), ('chemistry molecules', 'CHEM 1A')]:
            with self.subTest(query=query):
                self.assertIn(expected, [r['code'] for r in rag.search(query)['results'][:3]])

    def test_real_llamaindex_nodes_retriever_filters_and_score_floor(self):
        from llama_index.core.schema import NodeWithScore
        rows = [{'course_id': 'hist-15', 'code': 'HIST 15', 'title': 'US History', 'description': 'US history and government',
                 'units': 3, 'catalog_url': 'https://catalog.sjsu.edu/course/hist15', 'satisfies': ['GE 4', 'US1'],
                 'term_offered': ['spring-2027']}]
        nodes = catalog_nodes(rows)
        self.assertEqual(nodes[0].metadata['satisfies'], ['GE 4', 'US1'])
        self.assertEqual(nodes[0].node_id, 'catalog:hist-15')
        index = Mock()
        index.as_retriever.return_value.retrieve.return_value = [NodeWithScore(node=nodes[0], score=0.7),
                                                               NodeWithScore(node=nodes[0], score=0.1)]
        result = CatalogRAG(index).search('US history', {'satisfies': 'US1', 'term_offered': 'spring-2027'})
        self.assertEqual(len(result['results']), 1)
        self.assertEqual(result['results'][0]['code'], 'HIST 15')
        filters = index.as_retriever.call_args.kwargs['filters']
        self.assertEqual([(f.key, f.value) for f in filters.filters], [('satisfies', 'US1'), ('term_offered', 'spring-2027')])

    def test_filter_values_cannot_be_interpolated_into_postgres_sql(self):
        with self.assertRaises(ValueError):
            metadata_filters({'subject': "CS'; DROP TABLE kimi_transcript;--"})
        with self.assertRaises(ValueError):
            metadata_filters({'owner': 'someone-else'})
        with self.assertRaises(ValueError):
            vector_store('model-chosen-table')

    def test_empty_retrieval_does_not_invent_catalog_facts(self):
        index = Mock()
        index.as_retriever.return_value.retrieve.return_value = []
        self.assertEqual(CatalogRAG(index).search('unknown subject')['results'], [])

    def test_transcript_retrieval_always_has_owner_and_document_filters(self):
        index = Mock()
        index.as_retriever.return_value.retrieve.return_value = []
        with patch('agent_service.transcripts.retrieval_index', return_value=index):
            self.assertEqual(TranscriptIndex().search('account:one', 'unique-doc-id', 'history'), [])
        filters = index.as_retriever.call_args.kwargs['filters']
        self.assertEqual([(f.key, f.value) for f in filters.filters], [('owner', 'account:one'), ('document_id', 'unique-doc-id')])
        self.assertEqual(filters.condition.value, 'and')


if __name__ == '__main__':
    unittest.main()
