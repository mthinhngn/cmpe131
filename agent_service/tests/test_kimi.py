"""Kimi integration tests: real graph/interrupts, controlled model and official adapters."""
import copy
import unittest
from uuid import uuid4
from langgraph.types import Command
from langchain_core.messages import AIMessage
from fastapi import HTTPException
from pydantic import ValidationError
from agent_service.kimi_agent import create_kimi_graph
from agent_service.kimi_contracts import KimiDecision, PreferenceSignal
from agent_service.graph import request_state
from agent_service.plan_changes import apply_changes, verify_group
from agent_service.plan_changes import prerequisite_issues
from agent_service.memory_repository import learn
from agent_service.section_actions import prepare_sections
from agent_service.research_agent import ResearchAgent
from agent_service.kimi_budget import Budget, active_budget
from agent_service.server import RequestManager
from calendar_fixture import fixture_agent
from test_graph import context, intent


class Model:
    def __init__(self, decisions):
        self.decisions = list(decisions)
        self.calls = 0
        self.inputs = []

    def with_structured_output(self, *args, **kwargs):
        return self

    def invoke(self, messages):
        self.calls += 1
        self.inputs.append(messages)
        decision = self.decisions.pop(0)
        decision.setdefault('group', 'none')
        decision.setdefault('course_queries', [])
        decision['steps'] = [intent(s).model_dump() if 'source' not in s and 'destination' not in s else s for s in decision.get('steps', [])]
        try:
            return {'parsed': KimiDecision(**decision), 'parsing_error': None, 'raw': AIMessage(content='')}
        except ValidationError as exc:
            return {'parsed': None, 'parsing_error': exc, 'raw': AIMessage(content='')}


class Repository:
    def find(self, program, query, course_id=None):
        code = query.replace(' ', '').lower()
        if code not in ('cmpe131', 'cmpe142'):
            return []
        return [{'course_id': code, 'code': 'CMPE ' + code[4:], 'title': code, 'program_id': program}]


def ctx():
    value = context()
    value.update(capabilities=['apply_plan_changes', 'set_course_sections'], selected_sections={},
                 plan=[{'course_id': 'cmpe131', 'semester_slot': 6, 'status': 'planned'},
                       {'course_id': 'cmpe142', 'semester_slot': 7, 'status': 'in-progress'}])
    return value


def swap():
    return {'kind': 'course_action', 'group': 'swap', 'steps': [
        {'kind': 'move_course_in_plan', 'course_query': 'CMPE131', 'source_semester_slot': 6, 'semester_slot': 7},
        {'kind': 'move_course_in_plan', 'course_query': 'CMPE142', 'source_semester_slot': 7, 'semester_slot': 6}]}


def section_data():
    return {'status': 'available', 'term': 'fall-2026', 'sourceUrl': 'https://www.sjsu.edu/classes/', 'offerings': [
        {'courseCode': 'CMPE 131', 'component': 'LEC', 'classNumber': '12345', 'days': 'MW', 'times': '9:00AM-10:00AM', 'instructors': ['Fixture']},
        {'courseCode': 'CMPE 142', 'component': 'LEC', 'classNumber': '23456', 'days': 'MW', 'times': '9:30AM-10:30AM', 'instructors': ['Other']} ]}


class KimiTests(unittest.TestCase):
    def test_model_schema_requires_explicit_course_pair_field(self):
        self.assertIn('course_queries', KimiDecision.model_json_schema()['required'])
        with self.assertRaises(ValueError):
            KimiDecision.model_validate(dict(kind='course_action', group='swap', steps=[]))

    def test_decision_rejects_conflicting_or_empty_modes(self):
        invalid = [
            dict(kind='answer', reply='Done', steps=[dict(kind='remove_course_from_plan', course_query='CMPE131')]),
            dict(kind='course_action'),
            dict(kind='course_action', group='swap', course_queries=['CMPE131', 'CMPE142'], section_term='fall-2026', section_numbers=['12345']),
            dict(kind='course_action', group='swap', steps=[dict(kind='find_course', course_query=c) for c in ['CMPE131', 'CMPE142']]),
            dict(kind='course_action', section_numbers=['12345']),
            dict(kind='course_action', course_queries=['CMPE131', 'CMPE142']),
            dict(kind='read'), dict(kind='research', query='CMPE131'),
            dict(kind='answer', reply='Ready', query='plan'),
        ]
        for value in invalid:
            with self.subTest(value=value), self.assertRaises(ValueError):
                KimiDecision.model_validate({'group': 'none', 'course_queries': [], **value})

    def test_conflicting_decision_repairs_before_any_dispatch(self):
        from test_interpretation import ScriptedModel
        model = ScriptedModel(
            dict(kind='answer', group='none', course_queries=[], reply='Removed', steps=[dict(kind='remove_course_from_plan', course_query='CMPE131')]),
            dict(kind='course_action', group='none', course_queries=[], steps=[dict(kind='remove_course_from_plan', course_query='CMPE131')]))
        graph = create_kimi_graph(Repository(), model, fixture_agent())
        result = graph.invoke(request_state('Remove CMPE131', ctx()), {'configurable': {'thread_id': str(uuid4())}})
        self.assertEqual(result['__interrupt__'][0].value['action']['kind'], 'remove_course_from_plan')
        self.assertEqual(len(model.inputs), 2)
        self.assertIn('Only course_action', model.inputs[1][-1].content)

    def test_provider_parser_validation_reason_reaches_repair(self):
        graph, config, state, model = self.build([
            dict(kind='course_action', group='swap', steps=[]),
            dict(kind='course_action', group='swap', course_queries=['CMPE131', 'CMPE142'])])
        result = graph.invoke(state, config)
        self.assertEqual(result['pending_action']['kind'], 'apply_plan_changes')
        self.assertIn('A swap requires two moves', model.inputs[1][-1].content)

    def test_conflicting_decisions_fail_closed(self):
        from test_interpretation import ScriptedModel
        value = dict(kind='course_action', group='swap', course_queries=['CMPE131', 'CMPE142'], section_term='fall-2026', section_numbers=['12345'])
        model = ScriptedModel(*[copy.deepcopy(value) for _ in range(3)])
        graph = create_kimi_graph(Repository(), model, fixture_agent())
        result = graph.invoke(request_state('Swap these courses', ctx()), {'configurable': {'thread_id': str(uuid4())}})
        self.assertNotIn('__interrupt__', result)
        self.assertIsNone(result['pending_action'])
        self.assertEqual(len(model.inputs), 3)
        KimiDecision.model_validate(result['kimi_decision'])

    def test_saved_starting_term_resume_dispatches_pending_steps(self):
        snapshot = ctx(); snapshot['starting_term'] = None
        graph, config, state, model = self.build([
            dict(kind='course_action', steps=[dict(kind='move_course_in_plan', course_query='CMPE131', destination=dict(kind='numbered_semester', number=5))]),
            dict(kind='course_action', resume_pending=True)], snapshot)
        first = graph.invoke(state, config)
        self.assertEqual(first['pending_clarification']['kind'], 'starting_term')
        snapshot['starting_term'] = ctx()['starting_term']
        second = graph.invoke(request_state('I saved my starting term, continue', snapshot), config)
        self.assertEqual(second['__interrupt__'][0].value['action']['semester_slot'], 5)
        self.assertEqual(model.calls, 2)

    def build(self, decisions, snapshot=None):
        model = Model(decisions)
        graph = create_kimi_graph(Repository(), model, fixture_agent(), sections=lambda _: section_data())
        config = {'configurable': {'thread_id': str(uuid4())}}
        state = request_state('swap these courses', snapshot or ctx())
        state.update(kimi_count=0, kimi_observations=[], kimi_history=[], kimi_preferences={})
        return graph, config, state, model

    def test_implicit_swap_resolves_saved_slots(self):
        graph, config, state, _ = self.build([dict(kind='course_action', group='swap', course_queries=['CMPE131', 'CMPE142'])])
        result = graph.invoke(state, config)
        action = result['pending_action']
        self.assertEqual(action['kind'], 'apply_plan_changes')
        self.assertEqual([s['semester_slot'] for s in action['changes']], [7, 6])

    def test_typed_condition_blocks_before_dispatch(self):
        graph, config, state, _ = self.build([dict(kind='course_action', steps=[dict(kind='move_course_in_plan', course_query='CMPE131', destination=dict(kind='numbered_semester', number=5), conditions=['Only if eligible'])])])
        result = graph.invoke(state, config)
        self.assertNotIn('__interrupt__', result)
        self.assertIsNone(result['pending_action'])
        self.assertIn('conditions', result['reply'])

    def test_supervisor_destination_clarification_resumes_remaining_action(self):
        graph, config, state, model = self.build([
            dict(kind='course_action', steps=[dict(kind='move_course_in_plan', course_query='CMPE131')]),
            dict(kind='course_action', resume_pending=True, steps=[dict(kind='move_course_in_plan', course_query='CMPE131', destination=dict(kind='numbered_semester', number=5))])])
        first = graph.invoke(state, config)
        self.assertEqual(first['pending_clarification']['kind'], 'destination')
        second = graph.invoke(request_state('the fifth one', state['app_context']), config)
        self.assertEqual(second['__interrupt__'][0].value['action']['semester_slot'], 5)
        self.assertEqual(model.calls, 2)

    def test_supervisor_repairs_invalid_output_before_dispatch(self):
        from test_interpretation import ScriptedModel
        model = ScriptedModel(None, dict(kind='course_action', group='none', course_queries=[], steps=[dict(kind='remove_course_from_plan', course_query='CMPE131')]))
        graph = create_kimi_graph(Repository(), model, fixture_agent())
        result = graph.invoke(request_state('Remove CMPE131', ctx()), {'configurable': {'thread_id': str(uuid4())}})
        self.assertEqual(result['__interrupt__'][0].value['action']['kind'], 'remove_course_from_plan')
        self.assertEqual(len(model.inputs), 2)

    def test_supervisor_sees_catalog_codes_for_saved_ids(self):
        import json
        graph, config, state, model = self.build([dict(kind='answer', reply='Ready')])
        graph.invoke(state, config)
        context = json.loads(model.inputs[0][1].content)['context']
        self.assertEqual([p['code'] for p in context['plan']], ['CMPE 131', 'CMPE 142'])

    def test_intersecting_moves_repair_to_atomic_swap(self):
        independent = swap(); independent['group'] = 'none'
        graph, config, state, model = self.build([independent, swap()])
        output = graph.invoke(state, config)
        self.assertEqual(output['pending_action']['kind'], 'apply_plan_changes')
        self.assertEqual(model.calls, 2)

    def test_intersecting_moves_fail_closed_after_repairs(self):
        independent = swap(); independent['group'] = 'none'
        graph, config, state, model = self.build([copy.deepcopy(independent) for _ in range(3)])
        output = graph.invoke(state, config)
        self.assertNotIn('__interrupt__', output)
        self.assertIsNone(output['pending_action'])
        self.assertEqual(model.calls, 3)

    def test_greeting_does_not_delegate(self):
        graph, config, state, model = self.build([{'kind': 'answer', 'reply': 'Hello, I am Kimi.'}])
        result = graph.invoke(state, config)
        self.assertEqual(result['reply'], 'Hello, I am Kimi.')
        self.assertEqual(model.calls, 1)
        self.assertNotIn('__interrupt__', result)

    def test_typed_remove_skips_second_model_interpretation_and_resumes_child(self):
        graph, config, state, model = self.build([{'kind': 'course_action', 'steps': [{'kind': 'remove_course_from_plan', 'course_query': 'CMPE131'}]}])
        output = graph.invoke(state, config)
        action = output['__interrupt__'][0].value['action']
        after = copy.deepcopy(state['app_context']); after['revision'] = 'v2'
        after['plan'] = after['plan'][1:]
        final = graph.invoke(Command(resume={'action_id': action['action_id'], 'tool_call_id': action['tool_call_id'], 'status': 'succeeded', 'code': 'ok', 'message': 'ok', 'context': after}), config)
        self.assertIn('Removed CMPE 131', final['reply'])
        self.assertEqual(model.calls, 1)

    def test_atomic_swap_and_root_resume(self):
        graph, config, state, model = self.build([swap()])
        output = graph.invoke(state, config)
        action = output['__interrupt__'][0].value['action']
        self.assertEqual(action['kind'], 'apply_plan_changes')
        self.assertEqual(len(action['changes']), 2)
        after = apply_changes(state['app_context'], action); after['revision'] = 'v2'
        final = graph.invoke(Command(resume={'action_id': action['action_id'], 'tool_call_id': action['tool_call_id'], 'status': 'succeeded', 'context': after}), config)
        self.assertIn('verified', final['reply'])
        self.assertEqual(final['app_context']['plan'][1]['status'], 'in-progress')

    def test_group_preserves_sections_and_waits_for_workspace_acceptance(self):
        snapshot = ctx(); snapshot['selected_sections'] = {'fall-2026': ['unrelated-section']}
        graph, config, state, _ = self.build([swap()], snapshot)
        action = graph.invoke(state, config)['pending_action']
        after = apply_changes(snapshot, action)
        self.assertEqual(after['selected_sections'], snapshot['selected_sections'])
        final = graph.invoke(Command(resume={'action_id': action['action_id'], 'tool_call_id': action['tool_call_id'], 'status': 'failed', 'context': snapshot}), config)
        self.assertIn('rejected', final['reply'])
        self.assertEqual(final['app_context']['plan'], snapshot['plan'])

    def test_swap_half_applied_is_not_success(self):
        graph, config, state, _ = self.build([swap()])
        output = graph.invoke(state, config)
        action = output['pending_action']
        after = copy.deepcopy(state['app_context']); after['plan'][0]['semester_slot'] = 7
        final = graph.invoke(Command(resume={'action_id': action['action_id'], 'tool_call_id': action['tool_call_id'], 'status': 'succeeded', 'context': after}), config)
        self.assertTrue(final['error'])

    def test_no_unsupported_browser_dispatch(self):
        snapshot = ctx(); snapshot['capabilities'] = []
        graph, config, state, _ = self.build([swap()], snapshot)
        final = graph.invoke(state, config)
        self.assertIn('no atomic', final['error'])
        self.assertNotIn('__interrupt__', final)

    def test_failed_second_source_has_no_group(self):
        snapshot = ctx(); snapshot['plan'][1]['semester_slot'] = 5
        graph, config, state, _ = self.build([swap()], snapshot)
        final = graph.invoke(state, config)
        self.assertTrue(final['error'])
        self.assertNotIn('__interrupt__', final)
        self.assertEqual(snapshot['plan'][0]['semester_slot'], 6)

    def test_unknown_typo_requires_lookup_not_guessed_id(self):
        decision = swap(); decision['steps'][1]['course_query'] = 'CMP142'
        graph, config, state, _ = self.build([decision])
        final = graph.invoke(state, config)
        self.assertIn('matching course', final['error'])
        self.assertNotIn('__interrupt__', final)

    def test_read_observe_then_answer(self):
        graph, config, state, model = self.build([{'kind': 'read', 'query': 'plan'}, {'kind': 'answer', 'reply': 'Two courses are planned.'}])
        final = graph.invoke(state, config)
        self.assertEqual(model.calls, 2)
        self.assertEqual(len(final['kimi_observations'][0]['plan']), 2)

    def test_research_delegates_and_returns_evidence_to_supervisor(self):
        queries = []
        research = ResearchAgent(search=lambda query, deadline: queries.append(query) or [
            {'url': 'https://reddit.com/r/SJSU/example', 'title': 'Review', 'content': 'Fixture teaching review'}])
        model = Model([{'kind': 'research', 'query': 'CMPE131', 'section_term': 'fall-2026', 'research_sources': ['reddit']},
                       {'kind': 'answer', 'reply': 'Here is the review evidence: https://reddit.com/r/SJSU/example'}])
        graph = create_kimi_graph(Repository(), model, fixture_agent(), research=research, sections=lambda _: section_data())
        state = request_state('Research CMPE 131 reviews in Fall 2026 on Reddit', ctx())
        result = graph.invoke(state, {'configurable': {'thread_id': str(uuid4())}})
        self.assertEqual(len(queries), 1)
        self.assertIn('CMPE 131 Fixture', queries[0])
        self.assertIn('site:reddit.com', queries[0])
        self.assertEqual(model.calls, 2)
        self.assertEqual(result['kimi_observations'][0]['research']['sources'][0]['excerpt'], 'Fixture teaching review')
        self.assertNotIn('__interrupt__', result)

    def test_conditions_are_not_dropped(self):
        decision = swap(); decision['constraints'] = ['only if graduation is unchanged']
        graph, config, state, _ = self.build([decision])
        final = graph.invoke(state, config)
        self.assertNotIn('__interrupt__', final)
        self.assertIn('clarify', final['reply'])

    def test_identical_research_is_not_repeated(self):
        searches = []
        research = ResearchAgent(search=lambda query, deadline: searches.append(query) or [])
        decision = {'kind': 'research', 'query': 'CMPE131', 'section_term': 'fall-2026', 'research_sources': ['reddit']}
        model = Model([decision, decision])
        graph = create_kimi_graph(Repository(), model, fixture_agent(), research=research, sections=lambda _: section_data())
        result = graph.invoke(request_state('Find CMPE131 reviews', ctx()), {'configurable': {'thread_id': str(uuid4())}})
        self.assertEqual(len(searches), 1)
        self.assertEqual(model.calls, 2)
        self.assertIn('not establish enough reliable', result['reply'])
        self.assertNotIn('__interrupt__', result)

    def test_wrong_ack_ids_rejected(self):
        graph, config, state, _ = self.build([swap()])
        graph.invoke(state, config)
        with self.assertRaisesRegex(ValueError, 'Mismatched'):
            graph.invoke(Command(resume={'action_id': 'wrong', 'tool_call_id': 'wrong'}), config)

    def test_owner_isolation(self):
        manager = RequestManager(None)
        manager.authorize('thread', 'guest:a')
        with self.assertRaises(HTTPException):
            manager.authorize('thread', 'guest:b')
        manager.pool.shutdown()

    def test_wording_learning_threshold_and_dedup(self):
        signal = PreferenceSignal(category='wording', value='delete', evidence='delete')
        profile = {}
        for identity in ['a', 'a', 'b']:
            profile = learn(profile, identity, 'delete this course', [signal])
        self.assertFalse(profile['wording']['delete:prefer']['active'])
        profile = learn(profile, 'c', 'delete this course', [signal])
        self.assertTrue(profile['wording']['delete:prefer']['active'])
        self.assertEqual(learn(profile, 'd', 'forget wording', [], 'wording')['wording'], {})

    def test_invented_preference_evidence_ignored(self):
        signal = PreferenceSignal(category='source', value='reddit', evidence='use reddit')
        self.assertEqual(learn({}, 'a', 'hello', [signal]), {})

    def test_research_limits_and_duplicate_sources(self):
        agent = ResearchAgent(search=lambda q, d: [{'url': 'https://reddit.com/r/example', 'content': 'opinion'}, {'url': 'http://bad', 'content': 'bad'}])
        self.assertEqual(len(agent.invoke(['a', 'b'])['sources']), 1)
        with self.assertRaises(ValueError): agent.invoke(['a'] * 4)

    def test_research_bounds_excerpts_for_supervisor_context(self):
        agent = ResearchAgent(search=lambda q, d: [{'url': 'https://reddit.com/r/example', 'content': 'x' * 10000}])
        source = agent.invoke(['public query'])['sources'][0]
        self.assertEqual(len(source['excerpt']), 1000)
        self.assertEqual(source['url'], 'https://reddit.com/r/example')

    def test_section_selection_and_conflict(self):
        d = KimiDecision(course_queries=[], kind='course_action', group='none', query='CMPE131', section_term='fall-2026', section_numbers=['12345'])
        action = prepare_sections(Repository().find('x', 'CMPE131')[0], d, ctx(), section_data())
        self.assertEqual(action['class_numbers'], ['12345'])
        snapshot = ctx(); snapshot['selected_sections'] = {'fall-2026': ['23456']}
        with self.assertRaisesRegex(ValueError, 'conflict'):
            prepare_sections(Repository().find('x', 'CMPE131')[0], d, snapshot, section_data())

    def test_missing_lab_is_not_selected(self):
        data = section_data(); data['offerings'].append({**data['offerings'][0], 'component': 'LAB', 'classNumber': '34567'})
        d = KimiDecision(course_queries=[], kind='course_action', group='none', query='CMPE131', section_term='fall-2026', section_numbers=['12345'])
        with self.assertRaisesRegex(ValueError, 'component'):
            prepare_sections(Repository().find('x', 'CMPE131')[0], d, ctx(), data)

    def test_shared_search_budget(self):
        from agent_service.kimi_budget import charge
        import time
        token = active_budget.set(Budget(searches=1).start())
        try:
            charge('searches', time.monotonic()+30)
            with self.assertRaisesRegex(ValueError, 'budget'): charge('searches', time.monotonic()+30)
        finally: active_budget.reset(token)

    def test_prerequisite_order_checked_against_final_state(self):
        rules = [{'course_id': 'cmpe142', 'required_id': 'cmpe131', 'group_key': 'one', 'operator': 'AND', 'corequisite': False, 'manual_review': False}]
        before = ctx()
        self.assertFalse(prerequisite_issues(before, rules))
        after = copy.deepcopy(before)
        after['plan'][0]['semester_slot'], after['plan'][1]['semester_slot'] = 7, 6
        self.assertTrue(prerequisite_issues(after, rules))

    def test_group_rejects_unrelated_completion_changes(self):
        graph, config, state, _ = self.build([swap()])
        output = graph.invoke(state, config)
        action = output['pending_action']
        after = apply_changes(state['app_context'], action)
        after['completed_course_ids'].append('unrelated')
        self.assertFalse(verify_group(state['app_context'], after, action))

    def test_stale_reducer_rejects_before_changing_input(self):
        graph, config, state, _ = self.build([swap()])
        action = graph.invoke(state, config)['pending_action']
        before = copy.deepcopy(state['app_context']); before['revision'] = 'newer'
        with self.assertRaisesRegex(ValueError, 'Stale'): apply_changes(before, action)
        self.assertEqual(before['plan'][0]['semester_slot'], 6)
