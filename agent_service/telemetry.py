"""Optional, non-blocking observability; never retries application operations."""

import logging
import os


def trace_event(name, detail, *, trace_id=None, metadata=None):
    if not (os.getenv("LANGFUSE_PUBLIC_KEY") and os.getenv("LANGFUSE_SECRET_KEY")):
        return
    try:
        from langfuse import get_client
        kwargs = {"trace_context": {"trace_id": trace_id}} if trace_id else {}
        with get_client().start_as_current_observation(name=name, as_type="span", input={"detail": detail}, metadata=metadata or {}, **kwargs):
            pass
    except Exception:
        logging.getLogger("course-radar-agent").warning("Trace event delivery unavailable; application was not retried.")
