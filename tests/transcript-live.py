"""Paid local desktop integration using synthetic data; creates and cleans only its own account.

python tests/transcript-live.py
Requires canonical frontend/API/agent already running. No email or Google login is sent.
"""
import hashlib
import os
from pathlib import Path
import secrets
import subprocess
import sys
from uuid import uuid4

import psycopg
from pypdf import PdfWriter
from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from agent_service.transcripts import TranscriptService
from agent_service.catalog import CatalogRepository, database_url

owner = 'transcript-test-' + uuid4().hex
session, workspace_key = secrets.token_hex(32), secrets.token_hex(32)
digest = lambda value: hashlib.sha256(value.encode()).hexdigest()
users_url = 'postgresql://course_radar_users:course_radar_users@127.0.0.1:5433/course_radar_users'
writer = PdfWriter()
page = writer.add_blank_page(width=612, height=792)
font = DictionaryObject({NameObject('/Type'): NameObject('/Font'), NameObject('/Subtype'): NameObject('/Type1'), NameObject('/BaseFont'): NameObject('/Helvetica')})
page[NameObject('/Resources')] = DictionaryObject({NameObject('/Font'): DictionaryObject({NameObject('/F1'): font})})
stream = DecodedStreamObject()
stream.set_data(b'BT /F1 12 Tf 50 720 Td (SYNTHETIC TEST TRANSCRIPT - NO REAL STUDENT) Tj 0 -24 Td (Program: Computer Engineering) Tj 0 -24 Td (Fall 2025) Tj 0 -24 Td (HIST 15 Essentials of U.S. History 3 units Grade A Completed) Tj 0 -24 Td (Spring 2026) Tj 0 -24 Td (MATH 30 Calculus I 3 units Grade IP In Progress) Tj 0 -24 Td (ZZZZ 999 Unmatched Test Course 3 units Grade A Completed) Tj ET')
page[NameObject('/Contents')] = stream
(ROOT / 'tmp').mkdir(exist_ok=True)
writer.write(ROOT / 'tmp/synthetic-transcript.pdf')
try:
    with psycopg.connect(users_url) as connection:
        connection.execute('''INSERT INTO "User" (id,email,name,major,"startingSemester","workspaceKey","updatedAt")
            VALUES (%s,%s,%s,%s,%s,%s,now())''', (owner, owner + '@example.invalid', 'Synthetic Transcript Test', '', '', workspace_key))
        connection.execute('INSERT INTO "Session" ("tokenHash","userId","expiresAt") VALUES (%s,%s,now()+interval \'1 hour\')', (digest(session), owner))
    result = subprocess.run(['node', 'tests/transcript-live.cjs'], cwd=ROOT,
                            env={**os.environ, 'TRANSCRIPT_TEST_SESSION': session, 'TRANSCRIPT_TEST_OWNER': owner})
    if result.returncode:
        raise SystemExit(result.returncode)
    with psycopg.connect(database_url(), options='-c default_transaction_read_only=on') as connection:
        assert connection.execute('SELECT count(*) FROM kimi_transcript WHERE owner=%s', ('account:' + owner,)).fetchone()[0] == 0
        assert connection.execute('SELECT count(*) FROM data_kimi_transcripts WHERE metadata_->>\'owner\'=%s', ('account:' + owner,)).fetchone()[0] == 0
    print('PASS: transcript source/rows/vectors removed from PostgreSQL.')
finally:
    TranscriptService(CatalogRepository()).delete('account:' + owner)
    with psycopg.connect(users_url) as connection:
        workspace = connection.execute('SELECT id FROM "PersonalWorkspace" WHERE "tokenHash"=%s', (digest(workspace_key),)).fetchone()
        if workspace:
            connection.execute('DELETE FROM "PersonalOperation" WHERE "workspaceId"=%s', (workspace[0],))
            connection.execute('DELETE FROM "PersonalWorkspace" WHERE id=%s', (workspace[0],))
        connection.execute('DELETE FROM "User" WHERE id=%s', (owner,))
    print('Cleaned isolated synthetic test account and workspace.')
