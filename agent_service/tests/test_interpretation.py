"""Contract/execution tests with controlled model outputs, not language accuracy claims."""
import copy
import json
import unittest
from uuid import uuid4
from pydantic import ValidationError
from langchain_core.messages import AIMessage
from langgraph.types import Command
from agent_service.interpretation import ActionIntent, Interpretation
from agent_service.graph import create_graph, request_state
from calendar_fixture import fixture_agent
from test_graph import Repository, context
import test_graph


def move(destination=None, source=None):
    return dict(kind='move_course_in_plan', course_query='CS146', source=source, destination=destination)


def numbered(number):
    return dict(kind='numbered_semester', number=number)


class ScriptedModel:
    def __init__(self, *outputs):
        self.outputs = list(outputs)
        self.inputs = []

    def with_structured_output(self, schema, **kwargs):
        self.schema = schema
        return self

    def invoke(self, messages):
        self.inputs.append(messages)
        value = self.outputs.pop(0)
        if isinstance(value, Exception): raise value
        return dict(parsed=value, raw=AIMessage(content=''), parsing_error=None)


class InterpretationTests(unittest.TestCase):
    def setup_graph(self, *outputs):
        self.model = ScriptedModel(*outputs)
        self.repo = Repository()
        self.graph = create_graph(self.repo, self.model, fixture_agent())
        self.config = {'configurable': {'thread_id': str(uuid4())}}
        self.ctx = context()
        self.ctx['plan'] = [dict(course_id='se-cs146', semester_slot=2, status='in-progress')]

    def invoke(self, message, ctx=None):
        return self.graph.invoke(request_state(message, copy.deepcopy(ctx or self.ctx)), self.config)

    def test_schema_rejects_conflicting_roles_and_target_shapes(self):
        invalid = [move(dict(kind='numbered_semester', number=3, season='fall')),
                   move(numbered(True)), move(numbered(101)),
                   dict(kind='remove_course_from_plan', course_query='CS146', destination=numbered(3)),
                   dict(kind='add_course_to_plan', course_query='CS146', source=numbered(3))]
        for value in invalid:
            with self.subTest(value=value), self.assertRaises(ValidationError):
                ActionIntent.model_validate(value)

    def test_ordinal_and_non_english_destinations_are_not_erased(self):
        for wording in ('Move CS146 to my fifth semester', 'Chuyển CS146 sang học kỳ thứ năm', 'Put it in the fifth one'):
            self.setup_graph(dict(steps=[move(numbered(5))]))
            result = self.invoke(wording)
            self.assertEqual(result['pending_action']['semester_slot'], 5)
            self.assertEqual(self.model.inputs[0][-1].content, wording)
            self.assertEqual(result['pending_action']['previous_status'], 'in-progress')

    def test_destination_clarification_has_explicit_pending_state(self):
        self.setup_graph(dict(steps=[move()]), dict(steps=[move(numbered(5))], resume_pending=True))
        first = self.invoke('Move CS146')
        self.assertEqual(first['pending_clarification']['kind'], 'destination')
        second = self.invoke('the fifth one please')
        self.assertEqual(second['pending_action']['semester_slot'], 5)
        data = json.loads(self.model.inputs[1][1].content)
        self.assertEqual(data['pending_clarification']['steps'][0]['kind'], 'move_course_in_plan')

    def test_profile_reply_uses_model_intent_and_saved_profile(self):
        self.setup_graph(dict(steps=[move(numbered(5))]), dict(resume_pending=True))
        self.ctx['starting_term'] = None
        self.invoke('Move CS146 to my fifth semester')
        self.ctx['starting_term'] = 'spring-2026'
        result = self.invoke('I have saved my starting term now, please continue')
        self.assertEqual(result['pending_action']['semester_slot'], 5)

    def test_new_request_does_not_resume_stale_pending_action(self):
        self.setup_graph(dict(steps=[move()]), dict(steps=[dict(kind='find_course', course_query='CS146')]))
        self.invoke('Move CS146')
        result = self.invoke('Actually just show me its title')
        self.assertIsNone(result['pending_action'])
        self.assertIsNone(result['pending_clarification'])

    def test_conditions_block_all_actions_before_reads(self):
        for plan in (dict(steps=[{**move(numbered(5)), 'conditions': ['Only if the deadline permits it']}]),
                     dict(steps=[move(numbered(5))], research=['Check add deadline']),
                     dict(steps=[move(numbered(5))], clarification='Which destination do you mean?')):
            self.setup_graph(plan)
            result = self.invoke('Check first, then move it')
            self.assertIsNone(result['pending_action'])
            self.assertEqual(self.repo.calls, 0)

    def test_repairs_are_bounded_and_fail_closed(self):
        self.setup_graph({'steps': [move(numbered(101))]}, {'steps': [move(numbered(101))]}, None)
        result = self.invoke('Move it')
        self.assertEqual(len(self.model.inputs), 3)
        self.assertEqual(self.repo.calls, 0)
        self.assertIsNone(result['pending_action'])
        self.assertEqual(len([e for e in result['events'] if e['node'] == 'course_action.interpretation']), 3)

    def test_valid_repair_retains_source_and_destination(self):
        self.setup_graph(None, dict(steps=[move(numbered(5), numbered(2))]))
        result = self.invoke('Move CS146 from the second semester to the fifth')
        self.assertEqual(result['pending_action']['source_semester_slot'], 2)
        self.assertEqual(result['pending_action']['semester_slot'], 5)
        self.assertEqual(len(self.model.inputs), 2)

    def test_provider_failures_are_not_schema_retries(self):
        self.setup_graph(TimeoutError('Provider unavailable'))
        with self.assertRaises(TimeoutError): self.invoke('Move CS146')
        self.assertEqual(len(self.model.inputs), 1)
        self.assertEqual(self.repo.calls, 0)

    def test_removal_calendar_source_is_validated_against_entry(self):
        self.setup_graph(dict(steps=[dict(kind='remove_course_from_plan', course_query='CS146',
                                        source=dict(kind='calendar_term', season='spring', year=2027))]))
        result = self.invoke('Remove CS146 from Spring 2027')
        self.assertNotIn('__interrupt__', result)
        self.assertIn('No change was made', result['reply'])

    def test_completed_step_is_excluded_from_pending_continuation(self):
        self.setup_graph(dict(steps=[dict(kind='open_course', course_query='CS146'), move()]),
                         dict(steps=[move(numbered(5))], resume_pending=True))
        opened = self.invoke('Open CS146 then move it')
        receipt = test_graph.GraphTests().ack(opened)
        first = self.graph.invoke(Command(resume=receipt), self.config)
        self.assertEqual(len(first['pending_clarification']['steps']), 1)
        second = self.invoke('fifth semester', receipt['context'])
        self.assertEqual(second['pending_action']['kind'], 'move_course_in_plan')
