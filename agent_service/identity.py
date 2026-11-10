"""Verify accounts against the configured existing auth service; issue guest capabilities."""
import os
import secrets
import re
from urllib.parse import urlsplit
import httpx
from fastapi import HTTPException


def owner(request, response=None):
    bearer = request.headers.get('authorization', '')
    if not bearer and request.cookies.get('cr_session'):
        bearer = 'Bearer ' + request.cookies['cr_session']
    if bearer:
        if not bearer.startswith('Bearer ') or not re.fullmatch(r'[A-Za-z0-9_-]{20,512}', bearer[7:]):
            raise HTTPException(401, 'Invalid session credential')
        endpoint = os.getenv('KIMI_AUTH_URL')
        if not endpoint:
            raise HTTPException(503, 'Account auth bridge is not configured')
        p = urlsplit(endpoint)
        if p.scheme != 'https' and not (p.scheme == 'http' and p.hostname in {'localhost', '127.0.0.1'}):
            raise HTTPException(503, 'Invalid auth bridge configuration')
        try:
            r = httpx.get(endpoint, headers={'Cookie': 'cr_session=' + bearer[7:]}, timeout=5, follow_redirects=False)
            user = r.json().get('user') if r.status_code == 200 else None
        except (httpx.HTTPError, ValueError):
            raise HTTPException(503, 'Account verification unavailable') from None
        if not user or not isinstance(user.get('id'), str):
            raise HTTPException(401, 'Session expired; sign in again')
        return 'account:' + user['id']
    token = request.cookies.get('kimi_guest')
    if not token or len(token) != 64 or any(c not in '0123456789abcdef' for c in token):
        if response is None:
            raise HTTPException(401, 'Start a guest session first')
        token = secrets.token_hex(32)
        response.set_cookie('kimi_guest', token, httponly=True, samesite='strict', path='/agent', max_age=30*86400)
    return 'guest:' + token
