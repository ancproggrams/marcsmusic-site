import os
import stat
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import runtime


USERNAME = "calendar-test"
PASSWORD = "local-only-password-123"


class RuntimeBootstrapTests(unittest.TestCase):
    def test_bootstrap_is_atomic_canonical_and_idempotent(self):
        with tempfile.TemporaryDirectory() as directory:
            data_path = Path(directory) / "data"
            env = runtime_env()
            _, lock_descriptor = runtime.prepare_runtime(env, data_path)
            os.close(lock_descriptor)
            users_path = data_path / "users"
            persisted = users_path.read_bytes()

            _, lock_descriptor = runtime.prepare_runtime(env, data_path)
            os.close(lock_descriptor)

            self.assertEqual(users_path.read_bytes(), persisted)
            self.assertEqual(stat.S_IMODE(users_path.stat().st_mode), 0o600)
            self.assertEqual(stat.S_IMODE(data_path.stat().st_mode), 0o700)
            self.assertEqual(stat.S_IMODE((data_path / "collections").stat().st_mode), 0o700)
            (data_path / "collections").chmod(0o000)
            with self.assertRaisesRegex(RuntimeError, "permissions are unsafe"):
                runtime.prepare_runtime(env, data_path)
            (data_path / "collections").chmod(0o700)

    def test_rejects_mismatched_extra_and_unsafe_credentials_without_rewrite(self):
        with tempfile.TemporaryDirectory() as directory:
            data_path = Path(directory) / "data"
            env = runtime_env()
            _, lock_descriptor = runtime.prepare_runtime(env, data_path)
            os.close(lock_descriptor)
            users_path = data_path / "users"
            persisted = users_path.read_bytes()

            with self.assertRaisesRegex(RuntimeError, "do not match"):
                runtime.prepare_runtime({**env, "RADICALE_PASSWORD": "different-password-123"}, data_path)
            self.assertEqual(users_path.read_bytes(), persisted)

            users_path.write_bytes(persisted + b"extra:$2b$12$invalid\n")
            with self.assertRaisesRegex(RuntimeError, "not canonical"):
                runtime.prepare_runtime(env, data_path)
            users_path.write_bytes(persisted)
            users_path.chmod(0o644)
            with self.assertRaisesRegex(RuntimeError, "unsafe permissions"):
                runtime.prepare_runtime(env, data_path)
            users_path.chmod(0o600)
            users_path.write_bytes(USERNAME.encode() + b":$2b$31$" + b"A" * 53 + b"\n")
            with (
                mock.patch.object(runtime.bcrypt, "checkpw", side_effect=AssertionError),
                self.assertRaisesRegex(RuntimeError, "not canonical"),
            ):
                runtime.prepare_runtime(env, data_path)
            users_path.write_bytes(b"A" * (runtime.MAX_USERS_FILE_BYTES + 1))
            with self.assertRaisesRegex(RuntimeError, "not canonical"):
                runtime.prepare_runtime(env, data_path)
            users_path.unlink()
            os.mkfifo(users_path, mode=0o600)
            with self.assertRaisesRegex(RuntimeError, "unsafe permissions or type"):
                runtime.prepare_runtime(env, data_path)

    def test_preflight_rejects_unsafe_state_before_writing(self):
        with tempfile.TemporaryDirectory() as directory:
            data_path = Path(directory) / "data"
            data_path.mkdir()
            before = list(data_path.iterdir())
            with self.assertRaisesRegex(RuntimeError, "offline migration"):
                runtime.preflight(data_path, USERNAME, PASSWORD, runtime.SERVICE_UID, runtime.SERVICE_GID)
            self.assertEqual(list(data_path.iterdir()), before)

            outside_path = Path(directory) / "outside"
            outside_path.mkdir()
            (data_path / "collections").symlink_to(outside_path, target_is_directory=True)
            with self.assertRaisesRegex(RuntimeError, "unsafe type"):
                runtime.prepare_runtime(runtime_env(), data_path)

    def test_rejects_special_collection_files_and_missing_credentials(self):
        with tempfile.TemporaryDirectory() as directory:
            data_path = Path(directory) / "data"
            _, lock_descriptor = runtime.prepare_runtime(runtime_env(), data_path)
            os.close(lock_descriptor)
            os.mkfifo(data_path / "collections" / "unsafe")
            with self.assertRaisesRegex(RuntimeError, "unsafe file type"):
                runtime.prepare_runtime(runtime_env(), data_path)
            (data_path / "collections" / "unsafe").unlink()
            unsafe_path = data_path / "collections" / "unsafe"
            unsafe_path.write_text("unsafe", encoding="utf-8")
            unsafe_path.chmod(0o000)
            with self.assertRaisesRegex(RuntimeError, "permissions are unsafe"):
                runtime.prepare_runtime(runtime_env(), data_path)

        with tempfile.TemporaryDirectory() as directory:
            data_path = Path(directory) / "data"
            collections_path = data_path / "collections"
            collections_path.mkdir(parents=True)
            data_path.chmod(0o700)
            collections_path.chmod(0o700)
            event_path = collections_path / "event.ics"
            event_path.write_text("event", encoding="utf-8")
            event_path.chmod(0o600)
            with self.assertRaisesRegex(RuntimeError, "recovered credentials"):
                runtime.prepare_runtime(runtime_env(), data_path)

    def test_volume_lock_blocks_a_second_instance_and_recovers_stale_bootstrap_files(self):
        with tempfile.TemporaryDirectory() as directory:
            data_path = Path(directory) / "data"
            _, lock_descriptor = runtime.prepare_runtime(runtime_env(), data_path)
            self.assertTrue(os.get_inheritable(lock_descriptor))
            persisted = (data_path / "users").read_bytes()
            with self.assertRaisesRegex(RuntimeError, "already owns"):
                runtime.prepare_runtime(runtime_env(), data_path)
            self.assertEqual((data_path / "users").read_bytes(), persisted)
            os.close(lock_descriptor)

            stale_path = data_path / ".users-bootstrap-stale"
            stale_path.write_text("stale", encoding="utf-8")
            stale_path.chmod(0o600)
            second_stale_path = data_path / ".users-bootstrap-second"
            second_stale_path.write_text("stale", encoding="utf-8")
            second_stale_path.chmod(0o600)
            with self.assertRaisesRegex(RuntimeError, "multiple stale"):
                runtime.prepare_runtime(runtime_env(), data_path)
            self.assertEqual(stale_path.read_text(encoding="utf-8"), "stale")
            self.assertEqual(second_stale_path.read_text(encoding="utf-8"), "stale")
            second_stale_path.unlink()
            _, lock_descriptor = runtime.prepare_runtime(runtime_env(), data_path)
            os.close(lock_descriptor)
            self.assertFalse(stale_path.exists())

    def test_rejects_invalid_config_and_runtime_identity(self):
        with self.assertRaisesRegex(RuntimeError, "path is invalid"):
            runtime.prepare_runtime(runtime_env(), Path("relative"))
        with self.assertRaisesRegex(RuntimeError, "invalid format"):
            runtime.validate_credentials("bad:name", PASSWORD)
        with self.assertRaisesRegex(RuntimeError, "16 to 72"):
            runtime.validate_credentials(USERNAME, "short")
        runtime.validate_runtime_identity(0, 0, [0])
        runtime.validate_runtime_identity(runtime.SERVICE_UID, runtime.SERVICE_GID, [runtime.SERVICE_GID])
        with self.assertRaisesRegex(RuntimeError, "dedicated service identity"):
            runtime.validate_runtime_identity(1234, 1234, [])
        with tempfile.TemporaryDirectory() as directory, self.assertRaisesRegex(RuntimeError, "persistent volume"):
            runtime.require_persistent_volume(Path(directory))


def runtime_env():
    return {"RADICALE_USERNAME": USERNAME, "RADICALE_PASSWORD": PASSWORD}
