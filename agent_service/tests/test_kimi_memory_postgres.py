"""Opt-in local PostgreSQL tests; every row is isolated to a random test owner."""
import os
import unittest
from uuid import uuid4
import psycopg
from agent_service.catalog import database_url
from agent_service.memory_repository import PostgresMemory
from agent_service.kimi_contracts import PreferenceSignal


@unittest.skipUnless(os.getenv('KIMI_TEST_POSTGRES') == '1', 'Set KIMI_TEST_POSTGRES=1 for local database integration')
class PostgresTests(unittest.TestCase):
    def setUp(self):
        self.owner = 'kimi-test:' + str(uuid4())
        self.repo = PostgresMemory(); self.repo.initialize()

    def tearDown(self):
        with psycopg.connect(database_url(), connect_timeout=5) as c:
            c.execute('DELETE FROM kimi_memory WHERE owner=%s', (self.owner,))

    def test_restore_history_and_idempotent_save(self):
        self.repo.begin(self.owner, 'thread', 'req1', 'hello')
        self.repo.save(self.owner, 'thread', 'req1', 'hello', 'Hi', [])
        self.repo.save(self.owner, 'thread', 'req1', 'hello', 'Hi again', [])
        restored = PostgresMemory().load(self.owner, 'thread')
        self.assertEqual([m['content'] for m in restored['history']], ['hello', 'Hi'])
        self.assertEqual(PostgresMemory().load(self.owner + '-other', 'thread')['history'], [])

    def test_preference_is_cross_thread_and_forget_persists(self):
        signal = PreferenceSignal(category='source', value='reddit', evidence='use reddit')
        for i in range(3):
            self.repo.save(self.owner, 'thread', str(i), 'use reddit', 'Okay', [signal])
        self.assertTrue(self.repo.load(self.owner, 'other')['preferences']['source']['reddit:prefer']['active'])
        self.repo.save(self.owner, 'thread', 'forget', 'forget sources', 'Reset', [], 'source')
        self.assertEqual(PostgresMemory().load(self.owner, 'other')['preferences']['source'], {})

    def test_pending_message_is_retained_without_replay(self):
        self.repo.begin(self.owner, 'thread', 'pending', 'swap these')
        self.repo.begin(self.owner, 'thread', 'pending', 'swap these')
        restored = PostgresMemory().load(self.owner, 'thread')
        self.assertEqual(len(restored['history']), 1)
        self.assertEqual(restored['history'][0]['content'], 'swap these')
