import json
import socket
import time
import unittest
from unittest.mock import patch
from unittest.mock import MagicMock
from agent_service.web_tools import LookupFailure, OfficialSearchTools, PublicHTTPS, resolve_doh, https_bytes


class WebToolsTests(unittest.TestCase):
    def test_offering_uses_official_index_link_for_archived_term(self):
        source = {"url": "https://www.sjsu.edu/classes/index.php", "links": ["https://evil.org/classes/schedules/archive/fall-2025.php", "/classes/schedules/archive/fall-2025.php"]}
        with patch.object(OfficialSearchTools, "fetch", return_value=source) as fetch:
            self.assertEqual(OfficialSearchTools().schedule_url("fall-2025", time.monotonic()+10), "https://www.sjsu.edu/classes/schedules/archive/fall-2025.php")
        fetch.assert_called_once()

    def test_unlinked_term_is_unverified_without_guessing_a_url(self):
        with patch.object(OfficialSearchTools, "fetch", return_value={"url": "https://www.sjsu.edu/classes/index.php", "links": []}) as fetch:
            with self.assertRaises(LookupFailure) as error: OfficialSearchTools().schedule_url("fall-2030", time.monotonic()+10)
        self.assertEqual(error.exception.code, "schedule_not_published")
        fetch.assert_called_once()

    def test_search_filters_unapproved_hosts_and_bounds_results(self):
        response = {"results": [{"url": "https://www.sjsu.edu/calendar", "title": "Calendar"}, {"url": "https://www.sjsu.edu.evil.org/calendar"}]}
        with patch("agent_service.web_tools.https_bytes", return_value=(200, {}, json.dumps(response).encode())) as call:
            hits = OfficialSearchTools(key="test-only").search("public calendar query", time.monotonic() + 10)
        self.assertEqual(len(hits), 1)
        payload = json.loads(call.call_args.kwargs["body"])
        self.assertEqual(payload["include_domains"], ["sjsu.edu"])
        self.assertEqual(payload["max_results"], 5)
        self.assertFalse(payload["include_answer"])

    def test_rate_limit_is_one_attempt(self):
        with patch("agent_service.web_tools.https_bytes", return_value=(429, {}, b"private provider body")) as call:
            with self.assertRaises(LookupFailure) as error:
                OfficialSearchTools(key="test-only").search("calendar", time.monotonic() + 10)
        self.assertEqual(call.call_count, 1)
        self.assertNotIn("private provider body", str(error.exception))

    def test_redirect_to_private_host_is_rejected_before_second_fetch(self):
        with patch("agent_service.web_tools.https_bytes", return_value=(302, {"location": "https://127.0.0.1/admin"}, b"")) as call:
            with self.assertRaises(LookupFailure):
                OfficialSearchTools().fetch({"url": "https://www.sjsu.edu/calendar", "title": "Calendar"}, time.monotonic() + 10)
        self.assertEqual(call.call_count, 1)

    def test_private_dns_answer_never_opens_socket(self):
        answers = [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("127.0.0.1", 443))]
        with patch("agent_service.web_tools.socket.getaddrinfo", return_value=answers), patch("agent_service.web_tools.socket.socket") as connection:
            with self.assertRaises(LookupFailure):
                PublicHTTPS("api.tavily.com", timeout=1).connect()
        connection.assert_not_called()

    def dns_response(self, answers=None, **changes):
        return {"Status": 0, "TC": False, "Question": [{"name": "www.sjsu.edu.", "type": 1}], "Answer": answers if answers is not None else [{"name": "www.sjsu.edu.", "type": 5, "data": "www.sjsu.edu.akadns.net."}, {"name": "www.sjsu.edu.akadns.net.", "type": 1, "data": "130.65.218.11"}], **changes}

    def resolve(self, response):
        with patch("agent_service.web_tools.https_bytes", return_value=(200, {}, json.dumps(response).encode())) as call:
            result = resolve_doh("www.sjsu.edu", time.monotonic() + 10)
        self.assertEqual(call.call_count, 1)
        self.assertTrue(call.call_args.args[0].startswith("https://dns.google/resolve?"))
        self.assertEqual(call.call_args.kwargs["max_bytes"], 65536)
        return result

    def test_doh_follows_returned_cname_chain(self):
        self.assertEqual(self.resolve(self.dns_response()), ["130.65.218.11"])

    def test_doh_rejects_mixed_private_addresses(self):
        response = self.dns_response()
        response["Answer"].append({"name": "www.sjsu.edu.akadns.net.", "type": 1, "data": "127.0.0.1"})
        with self.assertRaises(LookupFailure) as error: self.resolve(response)
        self.assertEqual(error.exception.code, "unsafe_address")

    def test_failed_invalid_or_unrelated_answers_do_not_resolve(self):
        cases = [self.dns_response(Status=3), self.dns_response(TC=True), self.dns_response(Question=[{"name": "evil.org.", "type": 1}]), self.dns_response(answers=[{"name": "unrelated.org.", "type": 1, "data": "130.65.218.11"}]), self.dns_response(answers=[{"name": "www.sjsu.edu.", "type": 5, "data": "www.sjsu.edu."}]), self.dns_response(answers=[])]
        for response in cases:
            with self.subTest(response=response), self.assertRaises(LookupFailure): self.resolve(response)

    def test_doh_http_failure_is_one_attempt_without_system_fallback(self):
        with patch("agent_service.web_tools.https_bytes", return_value=(429, {}, b"private provider body")) as call, patch("agent_service.web_tools.socket.getaddrinfo") as system_dns:
            with self.assertRaises(LookupFailure) as error: resolve_doh("www.sjsu.edu", time.monotonic() + 10)
        self.assertEqual(call.call_count, 1)
        system_dns.assert_not_called()
        self.assertEqual(error.exception.code, "dns_resolver_failed")
        self.assertNotIn("private provider body", str(error.exception))

    def test_official_connection_pins_doh_ip_and_keeps_original_tls_name(self):
        context, raw_socket = MagicMock(), MagicMock()
        with patch("agent_service.web_tools.resolve_doh", return_value=["130.65.218.11"]) as resolver, patch("agent_service.web_tools.socket.getaddrinfo", side_effect=socket.gaierror("system DNS broken")) as system_dns, patch("agent_service.web_tools.socket.socket", return_value=raw_socket):
            PublicHTTPS("www.sjsu.edu", timeout=1, context=context).connect()
        resolver.assert_called_once()
        system_dns.assert_not_called()
        raw_socket.connect.assert_called_once_with(("130.65.218.11", 443))
        context.wrap_socket.assert_called_once_with(raw_socket, server_hostname="www.sjsu.edu")

    def test_dns_timeout_tls_failures_are_distinguishable_and_not_retried(self):
        import ssl
        for exception, code in [(socket.gaierror("private detail"), "dns_failed"), (TimeoutError("private detail"), "network_timeout"), (ssl.SSLError("private detail"), "tls_failed")]:
            with self.subTest(code=code), patch("agent_service.web_tools.PublicHTTPS") as connection:
                connection.return_value.request.side_effect = exception
                with self.assertRaises(LookupFailure) as error: https_bytes("https://www.sjsu.edu/calendar", time.monotonic() + 10)
                self.assertEqual(error.exception.code, code)
                self.assertNotIn("private detail", str(error.exception))
                connection.return_value.request.assert_called_once()
                connection.return_value.close.assert_called_once()
