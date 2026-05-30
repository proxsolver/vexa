"""Audit logging — writes request metadata to audit_logs table."""

import json
import logging
import os
from urllib.parse import quote_plus

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

logger = logging.getLogger("api_gateway.audit")

DB_HOST = os.environ.get("DB_HOST")
DB_PORT = os.environ.get("DB_PORT")
DB_NAME = os.environ.get("DB_NAME")
DB_USER = os.environ.get("DB_USER")
DB_PASSWORD = os.environ.get("DB_PASSWORD")

_engine = None


async def init_audit_db():
    global _engine
    if not all([DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD]):
        logger.warning("DB vars not configured — audit logging disabled")
        return
    url = f"postgresql+asyncpg://{quote_plus(DB_USER)}:{quote_plus(DB_PASSWORD)}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    _engine = create_async_engine(
        url,
        pool_size=5,
        max_overflow=5,
        pool_timeout=5,
    )
    logger.info("Audit DB engine initialized")


async def close_audit_db():
    global _engine
    if _engine:
        await _engine.dispose()
        _engine = None


async def write_audit_log(
    user_id,
    action,
    resource_type=None,
    resource_id=None,
    ip_address=None,
    user_agent=None,
    status_code=None,
    details=None,
):
    if not _engine:
        return
    try:
        async with _engine.connect() as conn:
            await conn.execute(
                text(
                    """
                    INSERT INTO audit_logs
                        (user_id, action, resource_type, resource_id,
                         ip_address, user_agent, status_code, details)
                    VALUES
                        (:uid, :action, :rtype, :rid,
                         :ip, :ua, :status, :details)
                    """
                ),
                {
                    "uid": user_id,
                    "action": action,
                    "rtype": resource_type,
                    "rid": resource_id,
                    "ip": ip_address,
                    "ua": (user_agent or "")[:512] or None,
                    "status": status_code,
                    "details": json.dumps(details or {}),
                },
            )
            await conn.commit()
    except Exception as e:
        logger.error("Audit log write failed", exc_info=True)
