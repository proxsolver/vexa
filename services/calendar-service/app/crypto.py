"""AES-256-GCM encryption/decryption for OAuth tokens."""

import os
import base64

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

_ALGORITHM = "aes-256-gcm"
_IV_LENGTH = 12


def _get_key() -> bytes:
    key = os.getenv("TOKEN_ENCRYPTION_KEY", "") or os.getenv("NEXTAUTH_SECRET", "")
    if not key or len(key) < 32:
        raise ValueError("TOKEN_ENCRYPTION_KEY must be at least 32 characters")
    return key[:32].encode("utf-8")


def encrypt(plaintext: str) -> str:
    key = _get_key()
    iv = os.urandom(_IV_LENGTH)
    aesgcm = AESGCM(key)
    ciphertext = aesgcm.encrypt(iv, plaintext.encode("utf-8"), None)
    return base64.b64encode(iv + ciphertext).decode("ascii")


def decrypt(ciphertext: str) -> str:
    raw = base64.b64decode(ciphertext)
    iv = raw[:_IV_LENGTH]
    data = raw[_IV_LENGTH:]
    key = _get_key()
    aesgcm = AESGCM(key)
    return aesgcm.decrypt(iv, data, None).decode("utf-8")
