"""Authenticated transcript endpoints; browser completion saves precede confirmation."""
import logging
import os
from urllib.parse import urlsplit, urlunsplit

import httpx

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, Response, UploadFile
from pydantic import BaseModel, ConfigDict, Field
from starlette.concurrency import run_in_threadpool

from .identity import owner as resolve_owner
from .transcripts import MAX_PDF_BYTES, account_owner

log = logging.getLogger('course-radar-agent')


def saved_workspace(request, owner):
    """Verify the save against the same trusted API that verified the account."""
    endpoint = urlsplit(os.getenv('KIMI_AUTH_URL', ''))
    if not endpoint.path.endswith('/auth/me') or endpoint.query or endpoint.fragment or endpoint.username or endpoint.password:
        raise HTTPException(503, 'The trusted workspace bridge is not configured')
    if endpoint.scheme != 'https' and not (endpoint.scheme == 'http' and endpoint.hostname in {'localhost', '127.0.0.1'}):
        raise HTTPException(503, 'The trusted workspace bridge is not configured')
    credential = request.headers.get('authorization', '')
    token = credential[7:] if credential.startswith('Bearer ') else request.cookies.get('cr_session', '')
    endpoint = urlunsplit(endpoint._replace(path=endpoint.path[:-len('auth/me')] + 'workspace'))
    try:
        response = httpx.get(endpoint, headers={'Cookie': 'cr_session=' + token, 'X-Workspace-User': owner[8:]},
                             timeout=15, follow_redirects=False)
        state = response.json().get('state', {}) if response.status_code == 200 else {}
        completed = state.get('completed')
        if not isinstance(completed, list) or any(not isinstance(value, str) for value in completed):
            raise ValueError()
        return state
    except (httpx.HTTPError, ValueError, TypeError):
        raise HTTPException(503, 'The workspace API could not verify saved completions. Retry confirmation after reloading your workspace.') from None


class ConfirmTranscript(BaseModel):
    model_config = ConfigDict(extra='forbid')
    document_id: str = Field(min_length=36, max_length=36)
    row_ids: list[str] = Field(min_length=1, max_length=500)
    completed_course_ids: list[str] = Field(max_length=5000)


def transcript_router(service):
    def private_response(response: Response):
        response.headers['Cache-Control'] = 'no-store'

    router = APIRouter(prefix='/agent/transcript', dependencies=[Depends(private_response)])

    def mutation_origin(request):
        allowed = os.getenv('WEB_ORIGIN', 'http://localhost:5175,http://127.0.0.1:5175').split(',')
        origin = request.headers.get('origin')
        if origin not in allowed and not (origin is None and request.headers.get('authorization', '').startswith('Bearer ')):
            raise HTTPException(403, 'Transcript changes must come from the configured Course Radar website')

    def authenticated(request):
        try:
            return account_owner(resolve_owner(request))
        except PermissionError as exc:
            raise HTTPException(403, str(exc)) from None

    def call(operation, *args):
        try:
            return operation(*args)
        except ValueError as exc:
            raise HTTPException(400, str(exc)) from None
        except PermissionError as exc:
            raise HTTPException(403, str(exc)) from None
        except Exception:
            # Never log a transcript or a provider payload containing private source text.
            log.warning('Transcript operation unavailable; no provider payload logged')
            raise HTTPException(503, 'Transcript processing is unavailable. Your saved completion records are unchanged.') from None

    @router.get('')
    def current(request: Request):
        return call(service.get, authenticated(request))

    @router.post('')
    async def upload(request: Request, file: UploadFile = File(...), consent: bool = Form(False), program_id: str = Form('')):
        owner = authenticated(request)
        mutation_origin(request)
        if not consent:
            raise HTTPException(400, 'Consent to OpenAI processing is required')
        content = await file.read(MAX_PDF_BYTES + 1)
        await file.close()
        if len(content) > MAX_PDF_BYTES or not content.startswith(b'%PDF-'):
            raise HTTPException(400, 'Upload a PDF of at most 10 MB')
        return await run_in_threadpool(call, service.upload, owner, content, program_id)

    @router.post('/confirm')
    def confirm(data: ConfirmTranscript, request: Request):
        owner = authenticated(request)
        mutation_origin(request)
        return call(service.confirm, owner, data.document_id, data.row_ids, saved_workspace(request, owner))

    @router.delete('')
    def delete(request: Request):
        mutation_origin(request)
        return call(service.delete, authenticated(request))

    return router
