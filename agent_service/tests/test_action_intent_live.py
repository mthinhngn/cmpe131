"""Opt-in paid semantic regression: KIMI_TEST_LIVE_ACTION_INTENT=1 python -m unittest discover -s agent_service/tests -p test_action_intent_live.py -v"""
import copy
import json
import os
import unittest
from pathlib import Path

from agent_service.verifier import ActionAuthorization, verify_action_request


@unittest.skipUnless(os.getenv('KIMI_TEST_LIVE_ACTION_INTENT') == '1', 'Opt-in live intent model evaluation')
class ActionIntentLiveTests(unittest.TestCase):
    def test_natural_language_and_scope_preservation(self):
        from dotenv import load_dotenv
        from langchain_openai import ChatOpenAI
        load_dotenv(Path(__file__).resolve().parents[2] / '.env', encoding='utf-8-sig')
        judge = ChatOpenAI(model=os.getenv('KIMI_SMALL_MODEL', 'gpt-4.1-mini'), temperature=0,
                           max_retries=0, timeout=25, max_tokens=2000).with_structured_output(ActionAuthorization, method='function_calling')
        def add(code, target):
            return {'kind': 'add_course_to_plan', 'course_query': code, 'destination': target}
        current = {'kind': 'relative_term', 'relation': 'current'}
        following = {'kind': 'relative_term', 'relation': 'next'}
        def plan(steps):
            return {'kind': 'course_action', 'group': 'none', 'course_queries': [], 'steps': steps}
        pair = plan([add('CMPE 131', current), add('CMPE 142', following)])
        original = 'Add CMPE131 to the current semester and CMPE142 to the next semester'
        move = plan([{'kind': 'move_course_in_plan', 'course_query': 'CMPE 131',
                      'source': {'kind': 'numbered_semester', 'number': 2},
                      'destination': {'kind': 'numbered_semester', 'number': 4}}])
        cases = [(message, pair, True, []) for message in [
            original,
            'Put CMPE 131 in this term, with CMPE 142 in the following one.',
            "I'd like CMPE 131 on my plan this semester, then CMPE 142 next semester.",
            'Could you please schedule CMPE131 this semester and CMPE142 next semester?',
            'Thêm CMPE131 vào học kỳ hiện tại và CMPE142 vào học kỳ tiếp theo.',
        ]]
        cases += [
            ('Yes, do both.', pair, True, [{'role': 'human', 'content': original}, {'role': 'ai', 'content': 'Do you want both additions?'}]),
            ('Add CMPE131 and CMPE142 to Semester 2.', plan([add(c, {'kind': 'numbered_semester', 'number': 2}) for c in ['CMPE 131', 'CMPE 142']]), True, []),
            ('Shift CMPE131 from Semester 2 into Semester 4.', move, True, []),
            ('Should I take CMPE131 this semester and CMPE142 next semester?', pair, False, []),
            ('Can I take CMPE131 this semester and CMPE142 next semester?', pair, False, []),
            ('Do not add CMPE131 or CMPE142.', pair, False, []),
            ('Explain what this command means: ' + original, pair, False, []),
            (original, plan([add('CMPE 131', current), add('CMPE 142', current)]), False, []),
            (original, plan([add('CMPE 131', current)]), False, []),
            ('Add CMPE131 this semester if CMPE142 is offered next semester.', pair, False, []),
            ('Add CMPE131 this semester but leave CMPE142 unchanged.', pair, False, []),
        ]
        reversed_move = copy.deepcopy(move)
        reversed_move['steps'][0]['source'], reversed_move['steps'][0]['destination'] = move['steps'][0]['destination'], move['steps'][0]['source']
        cases.append(('Move CMPE131 from Semester 2 to Semester 4.', reversed_move, False, []))
        cases += [('Add CMPE 131 next semester.', plan([add('CMPE 131', target)]), expected, [])
                  for target, expected in [({'kind': 'calendar_term', 'season': 'spring', 'year': 2026}, False),
                                           (following, True),
                                           ({'kind': 'calendar_term', 'season': 'spring', 'year': 2027}, True)]]
        reports = []
        try:
            for message, decision, expected, history in cases:
                with self.subTest(message=message, expected=expected):
                    result = verify_action_request(message, decision, judge, history=history, today='2026-11-16',
                                                   calendar={'current_term': {'season': 'fall', 'year': 2026},
                                                             'next_term': {'season': 'spring', 'year': 2027}})
                    passed = result['verdict'] == ('pass' if expected else 'revise')
                    reports.append({'message': message, 'decision': decision, 'expected_authorized': expected,
                                    'passed': passed, 'result': result})
                    print(f"{'PASS' if passed else 'FAIL'}: {ascii(message)}", flush=True)
                    self.assertTrue(passed, result)
        finally:
            target = Path(__file__).resolve().parents[2] / 'tmp/action-intent-live.json'
            target.parent.mkdir(exist_ok=True)
            target.write_text(json.dumps(reports, indent=2, ensure_ascii=False), encoding='utf-8')
