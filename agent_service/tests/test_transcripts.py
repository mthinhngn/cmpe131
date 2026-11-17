import copy
from io import BytesIO
import unittest
from unittest.mock import Mock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from agent_service.transcripts import TranscriptService, read_pdf
from agent_service.transcript_routes import transcript_router, saved_workspace


class MemoryStore:
    def __init__(self):
        self.rows = {}

    def get(self, owner):
        return copy.deepcopy(self.rows.get(owner))

    def insert(self, owner, document_id, data, pdf, text):
        self.rows[owner] = {'document_id': document_id, 'data': copy.deepcopy(data), 'source_pdf': pdf, 'source_text': text}

    def update(self, owner, document_id, data):
        assert self.rows[owner]['document_id'] == document_id
        self.rows[owner]['data'] = copy.deepcopy(data)

    def delete(self, owner, document_id):
        assert self.rows[owner]['document_id'] == document_id
        del self.rows[owner]


class TranscriptTests(unittest.TestCase):
    def setUp(self):
        self.store, self.index, self.repository = MemoryStore(), Mock(), Mock()
        self.repository.find.return_value = [{'course_id': 'math-30', 'code': 'MATH 30'}]
        self.parsed = {'student_program': 'Computer Engineering', 'terms': [{'term': 'Fall 2025', 'courses': [
            {'code': 'MATH 30', 'title': 'Calculus I', 'units': 3, 'grade': 'A', 'status': 'completed',
             'source_text': 'MATH 30 Calculus I 3 A'},
            {'code': 'NOPE 99', 'title': 'Transfer Course', 'units': 4, 'grade': 'CR', 'status': 'transfer',
             'source_text': 'NOPE 99 Transfer Course 4 CR'}]}]}
        self.service = TranscriptService(self.repository, self.store, extractor=lambda _: self.parsed,
                                         reader=lambda _: 'MATH 30 Calculus I 3 A\nNOPE 99 Transfer Course 4 CR', index=self.index)

    def workspace(self):
        return {'program': 'computer-engineering', 'completed': ['math-30'], 'startingTerms': {'computer-engineering': 'fall-2025'},
                'plans': {'computer-engineering': {'math-30': {'semester': 1, 'status': 'planned'}}}}

    def upload(self, owner='account:one'):
        return self.service.upload(owner, b'%PDF-fixture', 'computer-engineering')

    def test_confirmation_requires_saved_matches_and_exact_lookup_skips_vector_search(self):
        result = self.upload()
        self.assertEqual(result['unmatched_count'], 1)
        with self.assertRaises(ValueError):
            self.service.confirm('account:one', result['document_id'], ['0'], {})
        result = self.service.confirm('account:one', result['document_id'], ['0'], self.workspace())
        self.assertEqual(result['status'], 'ready')
        self.assertEqual(self.service.facts('account:one', 'Have I taken MATH 30?')['courses'][0]['course_id'], 'math-30')
        self.assertEqual(self.service.facts('account:one', 'Have I taken MATH 31?')['courses'], [])
        self.index.search.assert_not_called()
        self.assertEqual(self.service.get('account:two')['status'], 'none')
        with self.assertRaises(ValueError):
            self.service.confirm('account:two', result['document_id'], ['0'], self.workspace())
        self.service.delete('account:one')
        self.index.delete.assert_called_once_with('account:one', result['document_id'])
        self.assertEqual(self.store.rows, {})

    def test_guest_rejected_before_pdf_or_model_processing(self):
        with self.assertRaises(PermissionError):
            self.upload('guest:one')
        self.repository.find.assert_not_called()

    def test_confirmation_rejects_wrong_term_even_when_completion_was_saved(self):
        result = self.upload()
        workspace = self.workspace()
        workspace['plans']['computer-engineering']['math-30']['semester'] = 2
        with self.assertRaisesRegex(ValueError, 'recorded term'):
            self.service.confirm('account:one', result['document_id'], ['0'], workspace)
        self.index.add.assert_not_called()

    def test_in_progress_is_confirmed_from_saved_status_without_marking_completed(self):
        self.parsed['terms'][0]['courses'][0].update(status='in_progress', grade='IP', source_text='MATH 30 Calculus I 3 IP')
        self.service.reader = lambda _: 'MATH 30 Calculus I 3 IP\nNOPE 99 Transfer Course 4 CR'
        result = self.upload()
        workspace = self.workspace()
        workspace['completed'] = []
        workspace['plans']['computer-engineering']['math-30']['status'] = 'in-progress'
        result = self.service.confirm('account:one', result['document_id'], ['0'], workspace)
        self.assertEqual(result['status'], 'ready')
        self.assertEqual(self.service.facts('account:one', 'MATH 30')['courses'][0]['status'], 'in_progress')
        self.service.confirm('account:one', result['document_id'], ['0'], workspace)
        self.index.add.assert_called_once()

    def test_onboarding_upload_without_major_matches_university_catalog(self):
        result = self.service.upload('account:one', b'%PDF-fixture', '')
        self.assertEqual(result['status'], 'pending')
        self.assertEqual(result['courses'][0]['course_id'], 'math-30')
        self.repository.find.assert_any_call('', 'MATH 30')

    def test_route_accepts_empty_or_missing_major_before_profile_setup(self):
        service = Mock()
        service.upload.return_value = {'status': 'pending', 'courses': []}
        app = FastAPI()
        app.include_router(transcript_router(service))
        client = TestClient(app, headers={'Origin': 'http://localhost:5175'})
        with patch('agent_service.transcript_routes.resolve_owner', return_value='account:one'):
            for fields in ({'consent': 'true'}, {'consent': 'true', 'program_id': ''}):
                response = client.post('/agent/transcript', data=fields,
                    files={'file': ('transcript.pdf', b'%PDF-fixture', 'application/pdf')})
                self.assertEqual(response.status_code, 200)
                service.upload.assert_called_with('account:one', b'%PDF-fixture', '')

    def test_pending_delete_needs_no_vector_database(self):
        self.upload()
        self.service.delete('account:one')
        self.index.delete.assert_not_called()
        self.assertEqual(self.store.rows, {})

    def test_partial_embedding_failure_is_pending_and_retry_cleans_partial_index(self):
        result = self.upload()
        self.index.add.side_effect = RuntimeError('provider failed')
        with self.assertRaises(RuntimeError):
            self.service.confirm('account:one', result['document_id'], ['0'], self.workspace())
        self.assertEqual(self.service.facts('account:one', 'history')['status'], 'pending')
        self.index.add.side_effect = None
        self.service.confirm('account:one', result['document_id'], ['0'], self.workspace())
        self.index.delete.assert_called_once_with('account:one', result['document_id'])

    def test_unsupported_grade_or_units_are_flagged(self):
        self.parsed['terms'][0]['courses'][0]['grade'] = 'B'
        self.parsed['terms'][0]['courses'][0]['units'] = 5
        result = self.upload()
        self.assertTrue(result['courses'][0]['needs_review'])
        self.assertIsNone(result['courses'][0]['course_id'])

    def test_real_pdf_reader_and_invalid_document(self):
        from pypdf import PdfWriter
        from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject
        writer = PdfWriter()
        page = writer.add_blank_page(width=612, height=792)
        font = DictionaryObject({NameObject('/Type'): NameObject('/Font'), NameObject('/Subtype'): NameObject('/Type1'),
                                 NameObject('/BaseFont'): NameObject('/Helvetica')})
        page[NameObject('/Resources')] = DictionaryObject({NameObject('/Font'): DictionaryObject({NameObject('/F1'): font})})
        stream = DecodedStreamObject()
        stream.set_data(b'BT /F1 12 Tf 50 700 Td (MATH 30 Calculus I 3 A) Tj ET')
        page[NameObject('/Contents')] = stream
        output = BytesIO()
        writer.write(output)
        self.assertIn('MATH 30', read_pdf(output.getvalue()))
        with self.assertRaises(ValueError):
            read_pdf(b'not pdf')

    def test_routes_enforce_consent_and_owner_and_saved_server_completion(self):
        app = FastAPI()
        app.include_router(transcript_router(self.service))
        client = TestClient(app, headers={'Origin': 'http://localhost:5175'})
        with patch('agent_service.transcript_routes.resolve_owner', return_value='account:one'):
            response = client.post('/agent/transcript', data={'program_id': 'computer-engineering'},
                                   files={'file': ('transcript.pdf', b'%PDF-fixture', 'application/pdf')})
            self.assertEqual(response.status_code, 400)
            response = client.post('/agent/transcript', data={'program_id': 'computer-engineering', 'consent': 'true'},
                                   files={'file': ('transcript.pdf', b'%PDF-fixture', 'application/pdf')})
            self.assertEqual(response.status_code, 200)
            with patch('agent_service.transcript_routes.saved_workspace', return_value={}):
                response = client.post('/agent/transcript/confirm', json={'document_id': response.json()['document_id'],
                    'row_ids': ['0'], 'completed_course_ids': ['math-30']})
                self.assertEqual(response.status_code, 400)
        with patch('agent_service.transcript_routes.resolve_owner', return_value='guest:one'):
            self.assertEqual(client.get('/agent/transcript').status_code, 403)

    def test_workspace_bridge_forwards_only_verified_session_and_account(self):
        request = Mock(headers={}, cookies={'cr_session': 'secret'})
        response = Mock(status_code=200)
        response.json.return_value = {'state': self.workspace()}
        with patch.dict('os.environ', {'KIMI_AUTH_URL': 'http://127.0.0.1:3004/api/v1/auth/me'}), \
             patch('agent_service.transcript_routes.httpx.get', return_value=response) as fetch:
            self.assertEqual(saved_workspace(request, 'account:one'), self.workspace())
        fetch.assert_called_once_with('http://127.0.0.1:3004/api/v1/workspace',
            headers={'Cookie': 'cr_session=secret', 'X-Workspace-User': 'one'}, timeout=15, follow_redirects=False)


if __name__ == '__main__':
    unittest.main()
