"""Read-only live semantic smoke test: python -m agent_service.evaluate_kimi."""
import json
import os
from pathlib import Path
from dotenv import load_dotenv
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_groq import ChatGroq
from .kimi_agent import PROMPT, HELP
from .kimi_contracts import KimiDecision


def main():
    load_dotenv(Path(__file__).resolve().parents[1] / '.env', encoding='utf-8-sig')
    if not os.getenv('GROQ_API_KEY'):
        print(json.dumps({'status': 'skipped', 'reason': 'Groq not configured'}))
        return
    model = ChatGroq(model=os.getenv('KIMI_MODEL', 'qwen/qwen3.8-27b'), temperature=0, timeout=35, max_retries=0, max_tokens=2000)
    planner = model.with_structured_output(KimiDecision, method='function_calling', include_raw=True)
    cases = [
        ('hey Kimi', lambda d: d.kind == 'answer' and not d.steps and len(d.reply.split()) >= 10 and 'help' in d.reply.lower()),
        ('switch CMPE131 from semester 6 and cmp142 from semester 7 to each other',
         lambda d: d.group == 'swap' and [(s.source_semester_slot, s.semester_slot) for s in d.steps] == [(6, 7), (7, 6)] and 'cmp142' in d.steps[1].course_query.lower().replace(' ', '')),
        ("Don't swap CMPE131 and CMPE142; just compare them.", lambda d: not d.steps and d.kind in ('read', 'research', 'clarify', 'answer')),
    ]
    for query, check in cases:
        try:
            result = planner.invoke([SystemMessage(content=PROMPT), SystemMessage(content=json.dumps({'help': HELP})), HumanMessage(content=query)])
            decision = KimiDecision.model_validate(result['parsed'])
            print(json.dumps({'query': query, 'passed': check(decision), 'decision': decision.model_dump()}, ensure_ascii=True), flush=True)
        except Exception as exc:
            print(json.dumps({'query': query, 'status': 'provider_error', 'type': type(exc).__name__}), flush=True)
            break


if __name__ == '__main__':
    main()
