"""Isolated UI fixture; never imported by production startup."""
import sys,re
from contextlib import asynccontextmanager
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'agent_service'/'tests'))
from langchain_core.messages import HumanMessage,AIMessage
from agent_service.contracts import RequestPlan
from agent_service.graph import create_graph
from agent_service.calendar_cache import CalendarCache
from agent_service.catalog import CatalogRepository
from calendar_fixture import CalendarTools,fixture_agent
import agent_service.server as server
class Tools(CalendarTools):
 def fetch(self,hit,deadline):
  source=super().fetch(hit,deadline)
  if 'summer-2026.php' in hit['url']:
   source['schedule_rows']=[r for r in source['schedule_rows'] if not r[0].startswith('CMPE 126 ')]
  return source
class Model:
 def with_structured_output(self,*a,**k): return self
 def invoke(self,messages):
  text=next(str(m.content) for m in reversed(messages) if isinstance(m,HumanMessage))
  code=re.search(r'\b[A-Z]{2,}\s*\d+[A-Z]*\b',text,re.I)
  term=re.search(r'\b(winter|spring|summer|fall)[ -]+(\d{4})',text,re.I)
  target=f'{term[1]} {term[2]}' if term else 'current' if 'current' in text.lower() else 'next' if 'next' in text.lower() else None
  slot=re.search(r'semester\s+(\d+)',text,re.I)
  kind='open_course' if text.lower().startswith(('open','find','search')) else 'remove_course_from_plan' if text.lower().startswith('remove') else 'move_course_in_plan' if text.lower().startswith('move') else 'add_course_to_plan'
  plan=RequestPlan(steps=[{'kind':kind,'course_query':code[0] if code else 'selected','term':target,'semester_slot':int(slot[1]) if slot and kind!='remove_course_from_plan' else None,'source_semester_slot':int(slot[1]) if slot and kind=='remove_course_from_plan' else None}])
  return {'parsed':plan,'raw':AIMessage(content=''),'parsing_error':None}
@asynccontextmanager
async def lifespan(app):
 server.calendar_cache=CalendarCache()
 server.manager=server.RequestManager(create_graph(CatalogRepository(),Model(),fixture_agent(Tools()),calendar_cache=server.calendar_cache))
 yield
 server.manager.pool.shutdown(wait=False,cancel_futures=True)
server.app.router.lifespan_context=lifespan
app=server.app
