"""Bot S3 credentials must be prefix-scoped, not the MinIO root key.

A bot container's env is visible to anyone who can `docker inspect` it.
Shipping the root key there exposed the entire bucket — every user's
recordings and their saved sign-in cookies — on one bot compromise.
"""

import json

import pytest

from meeting_api import meetings


def _fake_sts_factory(recorder):
    """Return a boto3.client stand-in that records the AssumeRole policy."""
    class FakeSTS:
        def assume_role(self, **kwargs):
            recorder["policy"] = json.loads(kwargs["Policy"])
            recorder["duration"] = kwargs["DurationSeconds"]
            recorder["session_name"] = kwargs["RoleSessionName"]
            return {
                "Credentials": {
                    "AccessKeyId": "TMPKEY",
                    "SecretAccessKey": "tmpsecret",
                    "SessionToken": "tmptoken",
                }
            }

    class FakeBoto3:
        def client(self, *a, **k):
            return FakeSTS()

    return FakeBoto3()


def test_scoped_creds_are_temporary_and_prefix_bound(monkeypatch):
    monkeypatch.setenv("MINIO_ACCESS_KEY", "ROOTKEY")
    monkeypatch.setenv("MINIO_SECRET_KEY", "rootsecret")
    monkeypatch.setenv("MINIO_BUCKET", "vexa")

    recorder = {}
    import sys
    monkeypatch.setitem(sys.modules, "boto3", _fake_sts_factory(recorder))

    creds = meetings._scoped_bot_s3_credentials(7, "users/7", ttl_seconds=3600)

    # Never the root key.
    assert creds["accessKey"] == "TMPKEY"
    assert creds["secretKey"] != "rootsecret"
    assert creds["sessionToken"] == "tmptoken"

    # Policy only grants this user's prefix.
    resources = [
        r
        for stmt in recorder["policy"]["Statement"]
        for r in (stmt["Resource"] if isinstance(stmt["Resource"], list) else [stmt["Resource"]])
    ]
    assert any("users/7/*" in r for r in resources)
    assert not any("users/1/" in r for r in resources)
    assert not any(r.endswith("recordings/*") for r in resources)


def test_duration_is_clamped_to_minio_max(monkeypatch):
    recorder = {}
    import sys
    monkeypatch.setitem(sys.modules, "boto3", _fake_sts_factory(recorder))

    meetings._scoped_bot_s3_credentials(1, "users/1", ttl_seconds=999999)
    assert recorder["duration"] == 43200  # 12h ceiling

    meetings._scoped_bot_s3_credentials(1, "users/1", ttl_seconds=10)
    assert recorder["duration"] == 900  # 15m floor


def test_falls_back_to_root_when_sts_unavailable(monkeypatch, caplog):
    monkeypatch.setenv("MINIO_ACCESS_KEY", "ROOTKEY")
    monkeypatch.setenv("MINIO_SECRET_KEY", "rootsecret")

    class Boom:
        def client(self, *a, **k):
            raise RuntimeError("STS not supported")

    import sys
    monkeypatch.setitem(sys.modules, "boto3", Boom())

    creds = meetings._scoped_bot_s3_credentials(1, "users/1", ttl_seconds=3600)

    # Degrades rather than breaking authenticated join; no session token.
    assert creds["accessKey"] == "ROOTKEY"
    assert creds["secretKey"] == "rootsecret"
    assert creds["sessionToken"] == ""
