"""Owned account memory; guests return memory to the browser, never to disk."""
import copy
import json
import re
from datetime import datetime, timezone
import psycopg
from psycopg.types.json import Jsonb
from .catalog import database_url

WORDS = {'remove', 'delete', 'move', 'swap', 'switch', 'replace', 'exchange', 'add'}
SOURCES = {'reddit', 'ratemyprofessors'}


def learn(profile, message_id, text, signals, forget='none'):
    result = copy.deepcopy(profile or {})
    for category in ('wording', 'source'):
        if forget in (category, 'all'):
            result[category] = {}
    for signal in signals:
        category, value = signal.category, signal.value.lower().replace(' ', '')
        if forget in (category, 'all') or signal.evidence.lower() not in text.lower():
            continue
        if value not in (WORDS if category == 'wording' else SOURCES):
            continue
        # Actual evidence must contain the observed word/source, not just an LLM claim.
        evidence = re.sub(r'[^a-z]', '', signal.evidence.lower())
        if value not in evidence and not (value == 'ratemyprofessors' and 'ratemyprofessor' in evidence):
            continue
        if signal.polarity == 'prefer' and re.search(r"\b(?:not|never|avoid|don't|dont|không)\b", signal.evidence.lower()):
            continue
        records = result.setdefault(category, {})
        key = value + ':' + signal.polarity
        entry = records.setdefault(key, {'value': value, 'polarity': signal.polarity, 'events': []})
        if message_id not in entry['events']:
            entry['events'] = (entry['events'] + [message_id])[-10:]
        entry['count'] = len(entry['events'])
        entry['active'] = entry['count'] >= 3
        entry['last_observed_at'] = datetime.now(timezone.utc).isoformat()
    return result


class PostgresMemory:
    def latest_thread(self, owner):
        with psycopg.connect(database_url(), connect_timeout=5) as c:
            row = c.execute("SELECT thread FROM kimi_memory WHERE owner=%s AND thread <> '__preferences__' ORDER BY updated_at DESC LIMIT 1", (owner,)).fetchone()
        return row[0] if row else None

    def initialize(self):
        with psycopg.connect(database_url(), connect_timeout=5) as c:
            c.execute('''CREATE TABLE IF NOT EXISTS kimi_memory (
                owner TEXT NOT NULL, thread TEXT NOT NULL, data JSONB NOT NULL,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY(owner, thread))''')

    def load(self, owner, thread):
        with psycopg.connect(database_url(), connect_timeout=5) as c:
            row = c.execute('SELECT data FROM kimi_memory WHERE owner=%s AND thread=%s', (owner, thread)).fetchone()
            prefs = c.execute("SELECT data FROM kimi_memory WHERE owner=%s AND thread='__preferences__'", (owner,)).fetchone()
        return {'history': (row[0] if row else {}).get('history', [])[-24:], 'preferences': prefs[0] if prefs else {}}

    def begin(self, owner, thread, request_id, text):
        with psycopg.connect(database_url(), connect_timeout=5) as c:
            c.execute('SELECT pg_advisory_xact_lock(hashtextextended(%s, 0))', (owner,))
            row = c.execute('SELECT data FROM kimi_memory WHERE owner=%s AND thread=%s', (owner, thread)).fetchone()
            data = row[0] if row else {'history': [], 'requests': []}
            pending = data.setdefault('pending', [])
            if request_id not in data['requests'] and request_id not in pending:
                pending.append(request_id)
                data['history'].append({'role': 'user', 'content': text})
                self._write(c, owner, thread, data)

    def save(self, owner, thread, request_id, user, reply, signals, forget='none'):
        with psycopg.connect(database_url(), connect_timeout=5) as c:
            # Serialize per owner, including first insertion. Never trust body-provided owner IDs.
            c.execute('SELECT pg_advisory_xact_lock(hashtextextended(%s, 0))', (owner,))
            row = c.execute('SELECT data FROM kimi_memory WHERE owner=%s AND thread=%s', (owner, thread)).fetchone()
            data = row[0] if row else {'history': [], 'requests': []}
            if request_id in data['requests']:
                return self._preferences(c, owner)
            prefs = learn(self._preferences(c, owner), request_id, user, signals, forget)
            pending = data.setdefault('pending', [])
            if request_id not in pending:
                data['history'].append({'role': 'user', 'content': user})
            else:
                pending.remove(request_id)
            data['history'].append({'role': 'assistant', 'content': reply})
            data['requests'] = data['requests'] + [request_id]
            self._write(c, owner, thread, data)
            self._write(c, owner, '__preferences__', prefs)
        return prefs

    @staticmethod
    def _preferences(c, owner):
        row = c.execute("SELECT data FROM kimi_memory WHERE owner=%s AND thread='__preferences__'", (owner,)).fetchone()
        return row[0] if row else {}

    @staticmethod
    def _write(c, owner, thread, data):
        c.execute('''INSERT INTO kimi_memory(owner,thread,data) VALUES(%s,%s,%s)
            ON CONFLICT(owner,thread) DO UPDATE SET data=excluded.data, updated_at=now()''', (owner, thread, Jsonb(data)))
