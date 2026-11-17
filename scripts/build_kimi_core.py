"""Rebuild the core ID manifest from the main cases, without model calls."""
import json
from pathlib import Path

EVALS = Path(__file__).resolve().parents[1] / 'agent_service' / 'evals'
STYLES = ('direct', 'polite', 'goal', 'terse', 'followup')


def core_ids(cases):
    actions = list(dict.fromkeys(c['id'].rsplit('_', 1)[0] for c in cases if c['group'] == 'actions'))
    action_styles = {name: {STYLES[(3 * i + offset) % 5] for offset in range(3)}
                     for i, name in enumerate(actions)}
    return [c['id'] for c in cases if
            (c['group'] == 'open' and c['need'] != 'policy') or
            c['group'] in ('traps', 'conversations') or
            (c['group'] == 'actions' and c['style'] in action_styles[c['id'].rsplit('_', 1)[0]])]


if __name__ == '__main__':
    ids = core_ids(json.loads((EVALS / 'kimi_conversations.json').read_text(encoding='utf-8')))
    assert len(ids) == len(set(ids)) == 101
    (EVALS / 'kimi_core.json').write_text(json.dumps(ids, indent=2) + '\n', encoding='utf-8')
