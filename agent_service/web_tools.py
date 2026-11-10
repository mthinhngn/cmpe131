"""Bounded, no-retry search and public HTTPS fetch adapters. No browser actions."""

import hashlib
import http.client
import ipaddress
import json
import os
import socket
import ssl
import time
from datetime import datetime, timezone
from html.parser import HTMLParser
from io import BytesIO
from urllib.parse import urlencode, urljoin, urlsplit, urlunsplit

MAX_BYTES = 8_000_000
OFFICIAL_HOSTS = {"www.sjsu.edu", "sjsu.edu"}


class LookupFailure(Exception):
    def __init__(self, code, message):
        self.code = code
        super().__init__(message)


def remaining(deadline):
    seconds = deadline - time.monotonic()
    if seconds <= 0:
        raise LookupFailure("budget_exhausted", "Web lookup reached its time limit. No action was taken.")
    return min(10, seconds)


def official_url(url):
    try:
        parts = urlsplit(url)
        host = (parts.hostname or "").lower()
        if parts.scheme != "https" or parts.username or parts.password or parts.port not in (None, 443):
            raise ValueError()
        # Reviewed calendar/offering hosts, not arbitrary model-selected domains.
        if host not in OFFICIAL_HOSTS:
            raise ValueError()
        return urlunsplit(("https", host, parts.path or "/", parts.query, ""))
    except (ValueError, TypeError):
        raise LookupFailure("unsafe_url", "A search result used an unapproved URL.") from None


def resolve_doh(host, deadline):
    """Resolve approved sources once over HTTPS; do not fall back or retry."""
    if host not in OFFICIAL_HOSTS:
        raise LookupFailure("unsafe_url", "DNS lookup requested an unapproved source host.")
    query = urlencode({"name": host, "type": "A", "edns_client_subnet": "0.0.0.0/0"})
    status, _, body = https_bytes(f"https://dns.google/resolve?{query}", deadline, max_bytes=65536)
    if status != 200:
        raise LookupFailure("dns_resolver_failed", f"DNS-over-HTTPS returned HTTP {status}. No automatic retry was made.")
    try:
        result = json.loads(body)
        if not isinstance(result, dict) or type(result.get("Status")) is not int:
            raise ValueError()
        if result["Status"] != 0:
            raise LookupFailure("dns_failed", f"DNS-over-HTTPS could not resolve {host} (DNS status {result['Status']}). No automatic retry was made.")
        if result.get("TC", False) is not False or result.get("Question") != [{"name": host + ".", "type": 1}]:
            raise ValueError()
        answers = result.get("Answer", [])
        if not isinstance(answers, list) or len(answers) > 40:
            raise ValueError()
        aliases, addresses = {}, {}
        for answer in answers:
            name = answer["name"].lower().rstrip(".")
            if answer["type"] == 5:
                alias = answer["data"].lower().rstrip(".")
                if name in aliases and aliases[name] != alias:
                    raise ValueError()
                aliases[name] = alias
            elif answer["type"] == 1:
                address = ipaddress.IPv4Address(answer["data"])
                if not address.is_global:
                    raise LookupFailure("unsafe_address", "DNS-over-HTTPS returned a non-public source address.")
                addresses.setdefault(name, []).append(str(address))
        name, visited = host, set()
        for _ in range(8):
            if name in visited:
                raise ValueError()
            visited.add(name)
            if name in addresses and name not in aliases:
                return addresses[name]
            if name not in aliases:
                break
            name = aliases[name]
    except (ValueError, TypeError, KeyError, AttributeError):
        raise LookupFailure("dns_invalid_result", "DNS-over-HTTPS returned an invalid or mismatched answer. No automatic retry was made.") from None
    raise LookupFailure("dns_no_addresses", f"DNS-over-HTTPS returned no usable IPv4 address for {host}. No automatic retry was made.")


class PublicHTTPS(http.client.HTTPSConnection):
    """Pin the validated DNS answer to the socket while retaining TLS hostname checks."""

    def connect(self):
        deadline = getattr(self, "deadline", time.monotonic() + 10)
        if self.host in OFFICIAL_HOSTS:
            addresses = [(socket.AF_INET, socket.SOCK_STREAM, 0, "", (ip, 443)) for ip in resolve_doh(self.host, deadline)]
        else:
            # The fixed DoH provider and Tavily bootstrap via the system resolver.
            addresses = socket.getaddrinfo(self.host, 443, type=socket.SOCK_STREAM)
        if not addresses or any(not ipaddress.ip_address(item[4][0]).is_global for item in addresses):
            raise LookupFailure("unsafe_address", "An official-source URL resolved to a non-public address.")
        family, kind, protocol, _, address = addresses[0]
        connection = socket.socket(family, kind, protocol)
        connection.settimeout(remaining(deadline))
        try:
            connection.connect(address)
            self.sock = self._context.wrap_socket(connection, server_hostname=self.host)
        except Exception:
            connection.close()
            raise


def https_bytes(url, deadline, *, body=None, headers=None, max_bytes=MAX_BYTES):
    parts = urlsplit(url)
    connection = PublicHTTPS(parts.hostname, timeout=remaining(deadline), context=ssl.create_default_context())
    connection.deadline = deadline
    try:
        path = urlunsplit(("", "", parts.path or "/", parts.query, ""))
        connection.request("POST" if body else "GET", path, body=body, headers={"User-Agent": "CourseRadar/1.0 academic-calendar-lookup", "Accept-Encoding": "identity", **(headers or {})})
        response = connection.getresponse()
        chunks, size = [], 0
        while True:
            if connection.sock:
                connection.sock.settimeout(remaining(deadline))
            data = response.read(min(65536, max_bytes + 1 - size))
            if not data:
                break
            chunks.append(data)
            size += len(data)
            if size > max_bytes:
                raise LookupFailure("source_too_large", "An official source exceeded the download limit.")
        remaining(deadline)
        return response.status, dict((k.lower(), v) for k, v in response.getheaders()), b"".join(chunks)
    except LookupFailure:
        raise
    except socket.gaierror:
        raise LookupFailure("dns_failed", f"System DNS could not resolve {parts.hostname}. No automatic retry was made.") from None
    except TimeoutError:
        raise LookupFailure("network_timeout", f"HTTPS connection or download timed out for {parts.hostname}. No automatic retry was made.") from None
    except ssl.SSLError:
        raise LookupFailure("tls_failed", f"HTTPS certificate or TLS verification failed for {parts.hostname}. No automatic retry was made.") from None
    except Exception:
        raise LookupFailure("network_failed", "Calendar search or download failed. No automatic retry was made.") from None
    finally:
        connection.close()


class PageText(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.hidden = 0
        self.parts = []
        self.links = []

    def handle_starttag(self, tag, attrs):
        if tag == "a" and len(self.links) < 2000:
            href = dict(attrs).get("href")
            if href: self.links.append(href)
        if tag in {"script", "style", "noscript"}:
            self.hidden += 1
        if tag in {"p", "tr", "td", "th", "li", "h1", "h2", "h3", "br", "div"}:
            self.parts.append("\n")

    def handle_endtag(self, tag):
        if tag in {"script", "style", "noscript"}:
            self.hidden = max(0, self.hidden - 1)

    def handle_data(self, data):
        if not self.hidden:
            self.parts.append(data)


class ScheduleTable(HTMLParser):
    """Read only the official schedule's structured rows, never page instructions."""
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.rows, self.headings = [], []
        self.row, self.cell, self.heading = None, None, None
        self.tables_closed = 0

    def handle_starttag(self, tag, attrs):
        if tag == "h1": self.heading = []
        if tag == "tr": self.row = []
        if tag == "td" and self.row is not None: self.cell = []
        if tag == "br" and self.cell is not None: self.cell.append(" ")

    def handle_data(self, data):
        if self.cell is not None: self.cell.append(data)
        if self.heading is not None: self.heading.append(data)

    def handle_endtag(self, tag):
        if tag == "h1" and self.heading is not None:
            self.headings.append(" ".join("".join(self.heading).split()))
            self.heading = None
        if tag == "td" and self.cell is not None:
            self.row.append(" ".join("".join(self.cell).split()))
            self.cell = None
        if tag == "tr" and self.row is not None:
            if len(self.row) >= 13: self.rows.append(self.row)
            self.row = None
        if tag == "table": self.tables_closed += 1


class OfficialSearchTools:
    def __init__(self, key=None):
        self.key = key if key is not None else os.getenv("TAVILY_API_KEY", "")

    def search(self, query, deadline):
        from .kimi_budget import charge
        deadline = charge('searches', deadline)
        if not self.key:
            raise LookupFailure("provider_not_configured", "Web Search needs TAVILY_API_KEY in the server environment. No course action was attempted.")
        payload = json.dumps({"query": query, "search_depth": "basic", "include_domains": ["sjsu.edu"], "max_results": 5, "include_answer": False, "include_raw_content": False}).encode()
        status, _, body = https_bytes("https://api.tavily.com/search", deadline, body=payload, headers={"Authorization": f"Bearer {self.key}", "Content-Type": "application/json"})
        if status != 200:
            raise LookupFailure("search_failed", f"Calendar search returned HTTP {status}. No automatic retry was made.")
        try:
            results = json.loads(body)["results"]
            if not isinstance(results, list):
                raise ValueError()
            hits = []
            for hit in results[:5]:
                try:
                    hits.append({"url": official_url(hit["url"]), "title": str(hit.get("title", "Official SJSU calendar"))[:300]})
                except LookupFailure:
                    continue
            return hits
        except (KeyError, ValueError, TypeError):
            raise LookupFailure("invalid_search_result", "The search provider returned an invalid result.") from None

    def schedule_url(self, term_id, deadline):
        source = self.fetch({"url": "https://www.sjsu.edu/classes/index.php", "title": "SJSU official schedule index"}, deadline)
        paths = {f"/classes/schedules/{term_id}.php", f"/classes/schedules/archive/{term_id}.php"}
        for href in source.get("links", []):
            try: candidate = official_url(urljoin(source["url"], href))
            except LookupFailure: continue
            if urlsplit(candidate).path in paths:
                return candidate
        raise LookupFailure("schedule_not_published", "The official schedule index did not link a published schedule for the requested term. Availability remains unverified; no planner change was made.")

    def fetch(self, hit, deadline):
        from .kimi_budget import charge
        deadline = charge('fetches', deadline)
        url = official_url(hit["url"])
        for _ in range(4):
            status, headers, body = https_bytes(url, deadline)
            if status in {301, 302, 303, 307, 308}:
                url = official_url(urljoin(url, headers.get("location", "")))
                continue
            if status != 200:
                raise LookupFailure("fetch_failed", f"An official calendar returned HTTP {status}. No automatic retry was made.")
            content_type = headers.get("content-type", "").split(";")[0].lower()
            if content_type == "application/pdf":
                from pypdf import PdfReader
                pdf = PdfReader(BytesIO(body))
                if len(pdf.pages) > 40:
                    text = ""
                else:
                    text = "\n".join(f"[Page {i + 1}]\n{page.extract_text() or ''}" for i, page in enumerate(pdf.pages))
            elif content_type in {"text/html", "application/xhtml+xml", "text/plain"}:
                schedule = ScheduleTable()
                schedule.feed(body.decode("utf-8", errors="replace"))
                parser = PageText()
                parser.feed(body.decode("utf-8", errors="replace"))
                text = "".join(parser.parts)
            else:
                text = ""
            text = " ".join(text.split())[:35000]
            remaining(deadline)
            result = {"source_id": hashlib.sha256(url.encode()).hexdigest()[:16], "url": url, "title": hit["title"], "retrieved_at": datetime.now(timezone.utc).isoformat(), "text": text, "content_hash": hashlib.sha256(body).hexdigest()}
            if content_type in {"text/html", "application/xhtml+xml", "text/plain"}:
                result.update(links=parser.links, schedule_rows=schedule.rows, headings=schedule.headings, complete_table=bool(schedule.tables_closed and b"</html>" in body.lower() and schedule.row is None))
            return result
        raise LookupFailure("redirect_limit", "An official source exceeded the redirect limit.")
