"""Prepare grouped changes without dispatching either half; verify whole-state results."""
import copy
from contextvars import Context
from uuid import uuid4
from .contracts import BrowserContext
from .course_action_agent import create_course_action_agent
from .kimi_contracts import KimiDecision


def prerequisite_issues(context, rules):
    from .web_contracts import parse_term, slot_term
    completed = set(context['completed_course_ids'])
    slots = {p['course_id']: p['semester_slot'] for p in context['plan']}
    def order(slot):
        if type(slot) is int:
            if not context.get('starting_term'):
                return slot
            return slot_term(context['starting_term'], slot).index
        return parse_term(slot).index
    grouped = {}
    for rule in rules:
        if rule['course_id'] in slots:
            grouped.setdefault((rule['course_id'], rule['group_key']), []).append(rule)
    issues = set()
    for (course, group), members in grouped.items():
        results = []
        for rule in members:
            required = rule['required_id']
            ok = required in completed
            if not ok and required in slots:
                left, right = order(slots[required]), order(slots[course])
                ok = left <= right if rule['corequisite'] else left < right
            results.append(ok and not rule['manual_review'])
        valid = any(results) if all(r['operator'] == 'OR' for r in members) else all(results)
        if not valid:
            issues.add((course, group))
    return issues


def apply_changes(context, action):
    """Pure reference reducer for the browser contract; never performs a side effect."""
    if action['expected_revision'] != context['revision']:
        raise ValueError('Stale browser context')
    result = copy.deepcopy(context)
    plans = {p['course_id']: dict(p) for p in result['plan']}
    if len(plans) != len(result['plan']):
        raise ValueError('Duplicate plan entries')
    for change in action['changes']:
        cid = change['course_id']
        if change['kind'] == 'add_course_to_plan':
            if cid in plans or cid in result['completed_course_ids']:
                raise ValueError('Course already planned or completed')
            plans[cid] = {'course_id': cid, 'semester_slot': change['semester_slot'], 'status': 'planned'}
        else:
            previous = plans.get(cid)
            if not previous or previous['semester_slot'] != change['previous_semester_slot'] or previous['status'] != change['previous_status']:
                raise ValueError('Source course changed')
            if change['kind'] == 'remove_course_from_plan':
                del plans[cid]
            else:
                previous['semester_slot'] = change['semester_slot']
        slot = change.get('semester_slot')
        if slot is not None and not (type(slot) is int and slot in (result.get("semester_slots") if result.get("semester_slots") is not None else range(1, result["semester_count"] + 1))):
            raise ValueError('Grouped changes currently require numbered semesters')
    result['plan'] = list(plans.values())
    BrowserContext.model_validate(result)
    return result


def verify_group(before, after, action):
    expected = apply_changes(before, action)
    actual = copy.deepcopy(after)
    expected.pop('revision', None); actual.pop('revision', None)
    expected['plan'] = sorted(expected['plan'], key=lambda p: p['course_id'])
    actual['plan'] = sorted(actual['plan'], key=lambda p: p['course_id'])
    return expected == actual


def prepare_group(repository, model, web_agent, decision, context, today=None):
    from .graph import request_state
    decision = KimiDecision.model_validate(decision)
    if 'apply_plan_changes' not in context.get('capabilities', []):
        raise ValueError('This browser has no atomic swap/replace handler yet. No courses were changed.')
    if decision.constraints:
        raise ValueError('Please clarify the additional conditions before this grouped change.')
    steps = [s.execution_step() for s in decision.steps]
    if decision.course_queries:
        courses = []
        for query in decision.course_queries:
            matches = repository.find(context['program_id'], query)
            if len(matches) != 1: raise ValueError(f'Please identify one catalog course for {query}.')
            courses.append(matches[0])
        existing = {p['course_id']: p for p in context['plan']}
        first = existing.get(courses[0]['course_id'])
        second = existing.get(courses[1]['course_id'])
        if not first: raise ValueError(f"{courses[0]['code']} is not in your plan. Which course should change?")
        if decision.group == 'swap' and not second:
            raise ValueError(f"{courses[1]['code']} is not in your plan. Did you mean replace?")
        if decision.group == 'replace' and second:
            raise ValueError(f"{courses[1]['code']} is already planned. Did you mean swap?")
        steps = [dict(kind='move_course_in_plan' if decision.group == 'swap' else 'remove_course_from_plan', course_query=courses[0]['code'], source_semester_slot=first['semester_slot'], semester_slot=second['semester_slot'] if second else None, term=None),
                 dict(kind='move_course_in_plan' if decision.group == 'swap' else 'add_course_to_plan', course_query=courses[1]['code'], source_semester_slot=second['semester_slot'] if second else None, semester_slot=first['semester_slot'], term=None)]
    actions = []
    for step in steps:
        state = request_state('', context)
        state['steps'] = [step]
        graph = create_course_action_agent(repository, model, web_agent, **({'today': today} if today else {}))
        # Preflight must not inherit the parent's LangGraph interrupt scratchpad:
        # otherwise its first single-course interrupt escapes as a live action.
        from .kimi_budget import active_budget
        budget = active_budget.get()
        def preflight():
            active_budget.set(budget)
            return graph.invoke(state)
        result = Context().run(preflight)
        interrupts = result.get('__interrupt__')
        if not interrupts:
            raise ValueError(result.get('reply') or result.get('error') or 'A course could not be validated')
        actions.append(interrupts[0].value['action'])
    if len({a['course_id'] for a in actions}) != 2:
        raise ValueError('Choose two distinct courses')
    if decision.group == 'swap':
        a, b = actions
        if a['semester_slot'] != b['previous_semester_slot'] or b['semester_slot'] != a['previous_semester_slot']:
            raise ValueError('The two destinations must exchange the current source semesters')
    elif actions[0]['previous_semester_slot'] != actions[1]['semester_slot']:
        raise ValueError('Replacement must use the removed course semester')
    # The workspace API identifies affected sections from saved offering snapshots;
    # class numbers alone cannot justify blocking unrelated course changes here.
    action = {'kind': 'apply_plan_changes', 'program_id': context['program_id'], 'operation': decision.group, 'action_id': str(uuid4()), 'tool_call_id': str(uuid4()),
              'expected_revision': context['revision'], 'changes': actions}
    after = apply_changes(context, action)
    if hasattr(repository, 'prerequisite_rules'):
        rules = repository.prerequisite_rules(context['program_id'])
        introduced = prerequisite_issues(after, rules) - prerequisite_issues(context, rules)
        if introduced:
            raise ValueError('The proposed change creates a prerequisite/corequisite ordering issue. No courses were changed.')
    action['validation_notes'] = 'Checks catalog ordering rules, not minimum grades or graduation eligibility.'
    return action
