"""Synthetic action cases shared by the scripted and opt-in live graph checks."""
from datetime import date

TODAY = date(2026, 11, 16)
CONTEXT = {'program_id': 'computer-engineering', 'page': '/planner', 'completed_course_ids': [],
           'starting_term': 'fall-2025', 'revision': 'action-eval', 'semester_count': 8,
           'selected_sections': {}, 'capabilities': ['apply_plan_changes', 'set_course_sections'],
           'plan': [{'course_id': 'cmpe131', 'semester_slot': 3, 'status': 'planned'},
                    {'course_id': 'cmpe142', 'semester_slot': 4, 'status': 'planned'}]}

ACTION_CASES = [
    ('numbered', 'Add HIST 15 to semester 5', {'kind': 'add_course_to_plan', 'course_code': 'HIST 15', 'semester_slot': 5}),
    ('calendar', 'Add HIST 15 to Spring 2027', {'kind': 'add_course_to_plan', 'course_code': 'HIST 15', 'semester_slot': 4}),
    ('next', 'add HIST 15 next semester', {'kind': 'add_course_to_plan', 'course_code': 'HIST 15', 'semester_slot': 4}),
    ('put_next', 'put AMS 10 in next semester', {'kind': 'add_course_to_plan', 'course_code': 'AMS 10', 'semester_slot': 4}),
    ('vietnamese_next', 'Thêm HIST 15 vào học kỳ tiếp theo', {'kind': 'add_course_to_plan', 'course_code': 'HIST 15', 'semester_slot': 4}),
    ('current', 'Add HIST 15 this semester', {'kind': 'add_course_to_plan', 'course_code': 'HIST 15', 'semester_slot': 3}),
    ('remove', 'Remove CMPE 131 from my plan', {'kind': 'remove_course_from_plan', 'course_code': 'CMPE 131'}),
    ('move', 'Move CMPE 131 to semester 6', {'kind': 'move_course_in_plan', 'course_code': 'CMPE 131', 'semester_slot': 6}),
    ('two_adds', 'Add HIST 15 to semester 5 and AMS 10 to semester 6', {'kind': 'add_course_to_plan', 'course_code': 'HIST 15', 'semester_slot': 5}),
    ('swap', 'Swap CMPE 131 and CMPE 142', {'kind': 'apply_plan_changes', 'operation': 'swap'}),
    ('replace', 'Replace CMPE 131 with CMPE 135', {'kind': 'apply_plan_changes', 'operation': 'replace'}),
    ('discussion', 'Should I add HIST 15 next semester?', None),
]
ACTION_CASES = [{'id': 'action_' + name, 'prompt': prompt, 'expected_action': expected,
                 'must_mutate': expected is not None, 'required_tools': [], 'golden': []}
                for name, prompt, expected in ACTION_CASES]


def dispatched_action(result):
    interrupts = result.get('__interrupt__', ())
    return interrupts[0].value['action'] if interrupts else None


def action_failures(result, expected):
    action = dispatched_action(result)
    if action is None:
        return ['expected action was not dispatched']
    return ['incorrect action field: ' + key for key, value in expected.items() if action.get(key) != value]
