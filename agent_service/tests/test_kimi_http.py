import unittest
from unittest.mock import patch
from fastapi.testclient import TestClient
from agent_service import server
from agent_service.identity import owner
from agent_service.server import RequestManager
from fastapi import HTTPException
from test_graph import context
from test_kimi import Model, Repository
from agent_service.kimi_agent import create_kimi_graph
from calendar_fixture import fixture_agent


class HTTPTests(unittest.TestCase):
    def setUp(self):
        self.manager = RequestManager(create_kimi_graph(Repository(), Model([{'kind': 'answer', 'reply': 'Hello'}]), fixture_agent()))
        self.patch = patch.object(server, 'manager', self.manager); self.patch.start()
        self.a, self.b = TestClient(server.app), TestClient(server.app)

    def tearDown(self):
        self.a.close(); self.b.close(); self.manager.pool.shutdown(); self.patch.stop()

    def test_guest_cookie_and_thread_ownership(self):
        data = {'thread_id': 'thread-is-not-a-password', 'request_id': 'request-identifier-123', 'message': 'hello', 'context': context()}
        response = self.a.post('/agent/messages', json=data)
        self.assertEqual(response.status_code, 202)
        self.assertIn('kimi_guest', self.a.cookies)
        self.b.post('/agent/session')
        stolen = self.b.get('/agent/requests/request-identifier-123?thread_id=thread-is-not-a-password')
        self.assertEqual(stolen.status_code, 404)

    def test_unapproved_origin_rejected(self):
        self.assertEqual(self.a.post('/agent/session', headers={'Origin': 'https://unrelated.example'}).status_code, 403)

    def test_body_owner_cannot_be_spoofed(self):
        data = {'owner': 'account:another-user', 'thread_id': 'test-thread-identifier', 'request_id': 'test-request-identifier', 'message': 'hello', 'context': context()}
        self.assertEqual(self.a.post('/agent/messages', json=data).status_code, 422)

    def test_account_not_silently_downgraded_to_guest(self):
        with patch.dict('os.environ', {'KIMI_AUTH_URL': ''}):
            response = self.a.post('/agent/session', headers={'Authorization': 'Bearer ' + 'a'*64})
        self.assertEqual(response.status_code, 503)

    def test_guest_memory_does_not_return_account_data(self):
        self.a.post('/agent/session')
        response = self.a.get('/agent/memory/new-thread-identifier')
        self.assertEqual(response.json()['storage'], 'browser')
        self.assertEqual(response.json()['history'], [])
