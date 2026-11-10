"""Isolated browser-test backend. Never imported by production startup."""
import copy
import os
import sys
from pathlib import Path
from contextlib import asynccontextmanager
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'agent_service' / 'tests'))
os.environ['WEB_ORIGIN'] = 'http://127.0.0.1:5186'
from fastapi import Request, Response
from langchain_core.messages import HumanMessage
from agent_service import server, schedule_data
from agent_service.kimi_agent import create_kimi_graph
from agent_service.kimi_contracts import KimiDecision
from agent_service.memory_repository import learn
from calendar_fixture import fixture_agent


SECTIONS = [
    {'courseCode': 'CMPE 131', 'sectionNumber': '01', 'classNumber': '91001', 'mode': 'In Person', 'component': 'LEC', 'days': 'MW', 'times': '10:00AM-11:15AM', 'instructors': ['Fixture'], 'location': 'ENG 101', 'dates': 'Fall 2026', 'openSeats': 10},
    {'courseCode': 'CMPE 131', 'sectionNumber': '02', 'classNumber': '91002', 'mode': 'In Person', 'component': 'LEC', 'days': 'TR', 'times': '1:00PM-2:15PM', 'instructors': ['Other Fixture'], 'location': 'ENG 102', 'dates': 'Fall 2026', 'openSeats': 10},
]


def sections(term):
    return {'status': 'available', 'term': term, 'offerings': SECTIONS, 'sourceUrl': 'https://www.sjsu.edu/classes/', 'message': ''}


class Repository:
    def find(self, program, query, course_id=None):
        normalized = query.lower().replace(' ', '')
        if normalized not in ('cmpe131', 'cmpe142'):
            return []
        return [{'course_id': 'ce-' + normalized, 'code': 'CMPE ' + normalized[4:], 'title': normalized, 'program_id': program}]


class Model:
    def with_structured_output(self, *args, **kwargs): return self
    def invoke(self, messages):
        query = str(next(m.content for m in reversed(messages) if isinstance(m, HumanMessage))).lower()
        if query.startswith('swap'):
            decision = KimiDecision(kind='course_action', group='swap', steps=[
                {'kind': 'move_course_in_plan', 'course_query': 'CMPE131', 'source_semester_slot': 6, 'semester_slot': 7},
                {'kind': 'move_course_in_plan', 'course_query': 'CMPE142', 'source_semester_slot': 7, 'semester_slot': 6}])
        elif query.startswith('select section'):
            decision = KimiDecision(kind='course_action', query='CMPE131', section_term='fall-2026', section_numbers=['91002'])
        elif 'reddit' in query:
            decision = KimiDecision(kind='answer', reply='Reddit preference observed.', signals=[{'category': 'source', 'value': 'reddit', 'evidence': 'reddit'}])
        else:
            decision = KimiDecision(kind='answer', reply='Hello from Kimi.')
        return {'parsed': decision, 'parsing_error': None}


class Memory:
    def __init__(self): self.data = {}; self.prefs = {}
    def latest_thread(self, owner): return next((thread for o, thread in reversed(self.data) if o == owner), None)
    def load(self, owner, thread): return {'history': copy.deepcopy(self.data.get((owner, thread), [])), 'preferences': copy.deepcopy(self.prefs.get(owner, {}))}
    def begin(self, *args): pass
    def save(self, owner, thread, request, user, reply, signals, forget):
        self.data.setdefault((owner, thread), []).extend([{'role': 'user', 'content': user}, {'role': 'assistant', 'content': reply}])
        self.prefs[owner] = learn(self.prefs.get(owner, {}), request, user, signals, forget)
        return self.prefs[owner]


@asynccontextmanager
async def lifespan(app):
    server.manager = server.RequestManager(create_kimi_graph(Repository(), Model(), fixture_agent(), sections=sections), memory=Memory())
    schedule_data.read_sections = sections
    yield
    server.manager.pool.shutdown()


original_owner = server.resolve_owner
def fixture_owner(request, response=None):
    account = request.cookies.get('fixture_account')
    return 'account:' + account if account in ('alpha', 'beta') else original_owner(request, response)
server.resolve_owner = fixture_owner
server.app.router.lifespan_context = lifespan
app = server.app


@app.post('/fixture/instance')
def restart_instance():
    from uuid import uuid4
    server.INSTANCE_ID = str(uuid4())
    return {'ok': True}
