"""Cognito ID-token auth for UI APIs. Same pool/client as Alyson. Never log tokens."""

from __future__ import annotations

import json
import logging
import os
import re
import urllib.error
import urllib.request
from typing import Any, Callable

logger = logging.getLogger(__name__)

AUTHENTICATION_REQUIRED = "AUTHENTICATION_REQUIRED"
INVALID_TOKEN = "INVALID_TOKEN"
AUTH_UNAVAILABLE = "AUTH_UNAVAILABLE"
WORKSPACE_REQUIRED = "WORKSPACE_REQUIRED"
NOT_A_MEMBER = "NOT_A_MEMBER"

MESSAGES = {
    AUTHENTICATION_REQUIRED: "Please sign in.",
    INVALID_TOKEN: "Your session has expired. Please sign in again.",
    AUTH_UNAVAILABLE: "Sign-in is temporarily unavailable. Please try again in a moment.",
    WORKSPACE_REQUIRED: "A workspace is required.",
    NOT_A_MEMBER: "You are not a member of this workspace.",
}

WORKSPACE_RE = re.compile(r"^[1-9][0-9]{0,9}$")
_JWKS_CACHE: dict[str, Any] = {"keys": None, "fetched_at": 0.0}
_JWKS_TTL = 3600
VerifyFn = Callable[[str], dict[str, Any]]


class AuthError(Exception):
    def __init__(self, status: int, code: str, message: str | None = None):
        self.status = status
        self.code = code
        self.message = message or MESSAGES.get(code, "Please sign in.")
        super().__init__(self.message)


class RequestAuth:
    def __init__(self, user: dict[str, Any], workspace_id: str | None = None):
        self.user = user
        self.workspace_id = workspace_id


def header_map(event: dict[str, Any]) -> dict[str, str]:
    raw = event.get("headers") or {}
    return {str(key).lower(): "" if value is None else str(value).strip() for key, value in raw.items()}


def read_token(event: dict[str, Any]) -> str | None:
    headers = header_map(event)
    token = headers.get("x-auth-token") or ""
    if token:
        return token
    auth = headers.get("authorization") or ""
    if auth.lower().startswith("bearer "):
        return auth[7:].strip()
    return None


def read_workspace_id(event: dict[str, Any]) -> str | None:
    value = header_map(event).get("x-workspace-id") or ""
    return value if WORKSPACE_RE.match(value) else None


def load_cognito_settings() -> tuple[str, list[str]]:
    pool = (os.environ.get("COGNITO_USER_POOL_ID") or "").strip()
    clients = (os.environ.get("COGNITO_CLIENT_IDS") or "").strip()
    client = (os.environ.get("COGNITO_CLIENT_ID") or "").strip()
    ids = [item.strip() for item in clients.split(",") if item.strip()] if clients else ([client] if client else [])
    if not pool or not ids:
        raise AuthError(503, AUTH_UNAVAILABLE)
    return pool, ids


def _jwks_url(pool_id: str) -> str:
    region = pool_id.split("_", 1)[0]
    return f"https://cognito-idp.{region}.amazonaws.com/{pool_id}/.well-known/jwks.json"


def fetch_jwks(pool_id: str) -> dict[str, Any]:
    import time

    now = time.time()
    if _JWKS_CACHE["keys"] is not None and now - float(_JWKS_CACHE["fetched_at"]) < _JWKS_TTL:
        return _JWKS_CACHE["keys"]
    req = urllib.request.Request(_jwks_url(pool_id), headers={"User-Agent": "cost-revenue-auth"})
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            keys = json.loads(resp.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError) as exc:
        logger.warning("cognito jwks unavailable: %s", type(exc).__name__)
        raise AuthError(503, AUTH_UNAVAILABLE) from exc
    _JWKS_CACHE["keys"] = keys
    _JWKS_CACHE["fetched_at"] = now
    return keys


def classify_verify_error(exc: Exception) -> AuthError:
    name = type(exc).__name__
    text = str(exc).lower()
    if isinstance(exc, AuthError):
        return exc
    if name in {"PyJWKClientError", "PyJWKError", "ConnectionError", "TimeoutError", "URLError", "OSError"}:
        return AuthError(503, AUTH_UNAVAILABLE)
    if "jwks" in text or "key" in text and ("fetch" in text or "unavailable" in text):
        return AuthError(503, AUTH_UNAVAILABLE)
    return AuthError(401, INVALID_TOKEN)


def default_verify(token: str) -> dict[str, Any]:
    try:
        import jwt
        from jwt import PyJWKClient
    except ImportError as exc:
        raise AuthError(503, AUTH_UNAVAILABLE) from exc
    pool, clients = load_cognito_settings()
    region = pool.split("_", 1)[0]
    issuer = f"https://cognito-idp.{region}.amazonaws.com/{pool}"
    try:
        jwks_client = PyJWKClient(_jwks_url(pool), cache_keys=True, lifespan=_JWKS_TTL)
        signing_key = jwks_client.get_signing_key_from_jwt(token)
        claims = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            audience=clients,
            issuer=issuer,
            options={"require": ["exp", "iat", "sub", "aud", "iss"]},
        )
    except Exception as exc:
        raise classify_verify_error(exc) from exc
    if claims.get("token_use") != "id":
        raise AuthError(401, INVALID_TOKEN)
    return claims


def user_from_claims(claims: dict[str, Any]) -> dict[str, Any]:
    email = claims.get("email") if isinstance(claims.get("email"), str) else None
    verified = claims.get("email_verified") is True
    return {
        "id": claims.get("sub"),
        "email": email,
        "cognitoSub": claims.get("sub"),
        "cognitoUsername": claims.get("cognito:username"),
        "verifiedEmail": email if verified else None,
    }


def allowed_workspaces() -> set[str] | None:
    raw = (os.environ.get("ALLOWED_WORKSPACES") or "").strip()
    if not raw:
        return None
    return {item.strip() for item in raw.split(",") if WORKSPACE_RE.match(item.strip())}


def authenticate_request(
    event: dict[str, Any],
    *,
    require_workspace: bool = True,
    verify: VerifyFn | None = None,
) -> RequestAuth:
    token = read_token(event)
    if not token:
        raise AuthError(401, AUTHENTICATION_REQUIRED)
    try:
        claims = (verify or default_verify)(token)
    except AuthError:
        raise
    except Exception as exc:
        raise classify_verify_error(exc) from exc
    if not isinstance(claims, dict) or not claims.get("sub"):
        raise AuthError(401, INVALID_TOKEN)
    user = user_from_claims(claims)
    workspace_id = None
    if require_workspace:
        workspace_id = read_workspace_id(event)
        if not workspace_id:
            raw = header_map(event).get("x-workspace-id")
            if raw:
                raise AuthError(400, WORKSPACE_REQUIRED)
            raise AuthError(400, WORKSPACE_REQUIRED)
        allowed = allowed_workspaces()
        if allowed is not None and workspace_id not in allowed:
            raise AuthError(403, NOT_A_MEMBER)
    return RequestAuth(user, workspace_id)


def auth_response(exc: AuthError, extra_headers: dict[str, str] | None = None) -> dict[str, Any]:
    headers = {"content-type": "application/json"}
    if extra_headers:
        headers.update(extra_headers)
    return {
        "statusCode": exc.status,
        "headers": headers,
        "body": json.dumps({"code": exc.code, "message": exc.message}),
    }


def cors_headers(methods: str = "GET,POST,OPTIONS") -> dict[str, str]:
    return {
        "content-type": "application/json",
        "access-control-allow-origin": "*",
        "access-control-allow-headers": "content-type,authorization,x-auth-token,x-workspace-id",
        "access-control-allow-methods": methods,
    }
