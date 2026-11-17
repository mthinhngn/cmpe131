"""Provider wiring checks without network calls."""
import unittest
from unittest.mock import patch, sentinel, call

from agent_service import graph
from agent_service.verifier import Verdict, ActionAuthorization


class OpenAIRuntimeTests(unittest.TestCase):
    def test_main_loop_uses_openai_and_actions_use_groq(self):
        with patch.dict('os.environ', {'OPENAI_API_KEY': 'test-key'}), \
             patch.object(graph, 'ChatOpenAI') as model, \
             patch.object(graph, 'ChatGroq', return_value=sentinel.action_model), \
             patch('agent_service.advisor_loop.AdvisorLoop', return_value=sentinel.advisor) as advisor, \
             patch.object(graph, 'create_web_search_agent', return_value=sentinel.web), \
             patch.object(graph, 'CachedWebAgent', return_value=sentinel.cached_web), \
             patch('agent_service.kimi_agent.create_kimi_graph', return_value=sentinel.graph) as kimi:
            self.assertIs(graph.create_runtime_graph(sentinel.repository), sentinel.graph)
        self.assertEqual(model.call_args_list[0].kwargs['model'], graph.OPENAI_MODEL_ID)
        self.assertEqual(model.call_args_list[0].kwargs['api_key'], 'test-key')
        self.assertEqual(model.call_args_list[0].kwargs['max_retries'], 0)
        self.assertEqual(model.call_count, 2)
        self.assertTrue(advisor.called)
        self.assertEqual(model.return_value.with_structured_output.call_args_list, [
            call(Verdict, method='function_calling'), call(ActionAuthorization, method='function_calling')])
        kimi.assert_called_once_with(sentinel.repository, model.return_value, sentinel.cached_web,
                                     action_model=sentinel.action_model, advisor=sentinel.advisor)
