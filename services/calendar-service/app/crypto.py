"""AES-256-GCM encryption/decryption for OAuth tokens.

Wire format (matches Node.js dashboard): base64(iv(12) + tag(16) + ciphertext)
"""

import os
import base64

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

_IV_LENGTH = 12
_TAG_LENGTH = 16


def _get_key() -> bytes:
    key = os.getenv("TOKEN_ENCRYPTION_KEY", "") or os.getenv("NEXTAUTH_SECRET", "")
    if not key or len(key) < 32:
        raise ValueError("TOKEN_ENCRYPTION_KEY must be at least 32 characters")
    return key[:32].encode("utf-8")


def encrypt(plaintext: str) -> str:
    key = _get_key()
    iv = os.urandom(_IV_LENGTH)
    aesgcm = AESGCM(key)
    ct_with_tag = aesgcm.encrypt(iv, plaintext.encode("utf-8"), None)
    # ct_with_tag = ciphertext + tag(16); produce iv + tag + ciphertext
    ct = ct_with_tag[:-_TAG_LENGTH]
    tag = ct_with_tag[-_TAG_LENGTH:]
    return base64.b64encode(iv + tag + ct).decode("ascii")


def decrypt(ciphertext: str) -> str:
    raw = base64.b64decode(ciphertext)
    iv = raw[:_IV_LENGTH]
    tag = raw[_IV_LENGTH : _IV_LENGTH + _TAG_LENGTH]
    ct = raw[_IV_LENGTH + _TAG_LENGTH :]
    # AESGCM.decrypt expects ciphertext + tag concatenated
    key = _get_key()
    aesgcm = AESGCM(key)
    return aesgcm.decrypt(iv, ct + tag, None).decode("utf-8")
