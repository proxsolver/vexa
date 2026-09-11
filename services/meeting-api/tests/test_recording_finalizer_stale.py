"""Regression tests for stale-master detection in the recording finalizer.

Meeting 53 (2026-09-11) recorded 2h39m but published a 59m master: a
rotation bug fired a terminal callback an hour in, the finalizer built a
master from the chunks available then, and every later finalize hit the
plain `master already exists` short-circuit. The remaining 1h39m of audio
sat in MinIO as chunks that nothing ever merged.
"""

import io
import wave

import pytest

from meeting_api.recording_finalizer import (
    _finalize_one_media_file_sync,
    _master_is_stale,
)


def _wav_chunk(seconds: float = 1.0, rate: int = 16000) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(b"\x00\x00" * int(rate * seconds))
    return buf.getvalue()


class FakeStorage:
    """In-memory StorageClient stand-in recording what got uploaded."""

    def __init__(self, objects: dict):
        self.objects = dict(objects)
        self.uploads = []

    def file_exists(self, path: str) -> bool:
        return path in self.objects

    def list_objects(self, prefix: str) -> list:
        return sorted(k for k in self.objects if k.startswith(prefix))

    def download_file(self, path: str) -> bytes:
        return self.objects[path]

    def upload_file(self, path: str, data: bytes, content_type: str = "") -> str:
        self.objects[path] = data
        self.uploads.append((path, len(data)))
        return path


PREFIX = "recordings/1/99/sess-uid/audio"


def _storage_with(chunks: int, master: bytes = None) -> FakeStorage:
    objects = {f"{PREFIX}/{i:06d}.wav": _wav_chunk() for i in range(chunks)}
    if master is not None:
        objects[f"{PREFIX}/master.wav"] = master
    return FakeStorage(objects)


def _frames(data: bytes) -> int:
    return wave.open(io.BytesIO(data)).getnframes()


@pytest.mark.parametrize(
    "finalized_at,created_at,expected",
    [
        ("2026-09-11T11:01:18", "2026-09-11T12:39:59", True),   # chunks kept coming
        ("2026-09-11T12:40:05", "2026-09-11T12:39:59", False),  # master is newest
        ("2026-09-11T11:01:18", "2026-09-11T11:01:18", False),  # same instant
        (None, "2026-09-11T12:39:59", False),                   # never finalized
        ("2026-09-11T11:01:18", None, False),                   # no chunk stamp
        (12345, "2026-09-11T12:39:59", False),                  # wrong type
    ],
)
def test_master_is_stale(finalized_at, created_at, expected):
    mf = {"finalized_at": finalized_at, "created_at": created_at}
    assert _master_is_stale(mf) is expected


def test_existing_master_is_left_alone_without_force():
    storage = _storage_with(chunks=3, master=_wav_chunk(seconds=1.0))

    key = _finalize_one_media_file_sync(storage, 1, f"{PREFIX}/000002.wav", "wav")

    assert key == f"{PREFIX}/master.wav"
    assert storage.uploads == []


def test_stale_master_is_rebuilt_from_every_chunk():
    # Master covers 1 of the 3 seconds actually recorded — the meeting-53 shape.
    storage = _storage_with(chunks=3, master=_wav_chunk(seconds=1.0))

    key = _finalize_one_media_file_sync(
        storage, 1, f"{PREFIX}/000002.wav", "wav", force_rebuild=True
    )

    assert key == f"{PREFIX}/master.wav"
    assert len(storage.uploads) == 1
    assert _frames(storage.objects[key]) == 3 * 16000


def test_rebuild_without_existing_master_still_builds():
    storage = _storage_with(chunks=2)

    key = _finalize_one_media_file_sync(
        storage, 1, f"{PREFIX}/000001.wav", "wav", force_rebuild=True
    )

    assert _frames(storage.objects[key]) == 2 * 16000


def test_rebuild_never_fabricates_a_master_without_chunks():
    storage = FakeStorage({f"{PREFIX}/master.wav": _wav_chunk()})

    key = _finalize_one_media_file_sync(
        storage, 1, f"{PREFIX}/000000.wav", "wav", force_rebuild=True
    )

    assert key is None
    assert storage.uploads == []
