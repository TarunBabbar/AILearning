"""Secrets: KMS envelope encryption for connection credentials.

Production: AWS KMS key (settings.kms_key_id) encrypts a per-workspace data
key; the data key encrypts the secret (AES-256-GCM). Ciphertext format:
  base64(nonce + ciphertext + tag), prefixed with a version byte.

Local dev (no KMS_KEY_ID): deterministic local AES-GCM fallback so the flow
works without AWS. Never log ciphertext or plaintext.
"""
import base64
import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from ..config import settings

try:
    import boto3  # noqa: F401  (optional — only when KMS is configured)
except ImportError:  # pragma: no cover
    boto3 = None

_VERSION = b"\x01"


def _local_key() -> bytes:
    """Derive a stable dev key from JWT_SECRET (dev-only fallback)."""
    return AESGCM(settings.jwt_secret.encode().ljust(32, b"\x00")[:32])


def _kms_decrypt(blob: bytes) -> bytes:
    if boto3 is None or not settings.kms_key_id:
        raise RuntimeError("KMS not configured")
    client = boto3.client("kms", region_name=settings.aws_region)
    resp = client.decrypt(CiphertextBlob=blob)
    return resp["Plaintext"]


def encrypt_secret(plaintext: str) -> str:
    data_key: bytes
    if settings.kms_key_id and boto3 is not None:
        client = boto3.client("kms", region_name=settings.aws_region)
        resp = client.generate_data_key(
            KeyId=settings.kms_key_id, KeySpec="AES_256"
        )
        data_key = resp["Plaintext"]
        wrapped = resp["CiphertextBlob"]
    else:
        data_key = _local_key()
        wrapped = b""

    nonce = os.urandom(12)
    ct = AESGCM(data_key).encrypt(nonce, plaintext.encode(), None)
    payload = base64.b64encode(wrapped) + b"|" + base64.b64encode(nonce + ct)
    return (_VERSION + payload).decode()


def decrypt_secret(ciphertext: str) -> str:
    raw = ciphertext.encode()
    if not raw.startswith(_VERSION):
        raise ValueError("Unknown ciphertext version")
    payload = raw[len(_VERSION):]
    wrapped_b64, body_b64 = payload.split(b"|", 1)

    data_key = _kms_decrypt(base64.b64decode(wrapped_b64)) if wrapped_b64 else _local_key()
    body = base64.b64decode(body_b64)
    nonce, ct = body[:12], body[12:]
    return AESGCM(data_key).decrypt(nonce, ct, None).decode()
