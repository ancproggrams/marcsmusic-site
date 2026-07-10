import fcntl
import os
import re
import secrets
import stat
from itertools import chain
from pathlib import Path

import bcrypt


SERVICE_UID = 10_001
SERVICE_GID = 10_001
DATA_PATH = Path("/data")
USERNAME_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$")
BCRYPT_HASH_PATTERN = re.compile(rb"^\$2b\$12\$[./A-Za-z0-9]{53}$")
MAX_USERS_FILE_BYTES = 256


def prepare_runtime(env=os.environ, data_path=DATA_PATH):
    username = required(env, "RADICALE_USERNAME")
    password = required(env, "RADICALE_PASSWORD")
    validate_credentials(username, password)
    data_path = absolute_path(data_path, "calendar data")

    data_path.mkdir(mode=0o700, parents=True, exist_ok=True)
    require_directory(data_path, "Calendar data")
    lock_descriptor = lock_directory(data_path)
    try:
        target_uid = SERVICE_UID if os.geteuid() == 0 else os.geteuid()
        target_gid = SERVICE_GID if os.geteuid() == 0 else os.getegid()
        state = preflight(data_path, username, password, target_uid, target_gid)
        for stale_path in state["stale_bootstrap_files"]:
            stale_path.unlink()
        collections_path = data_path / "collections"
        if not collections_path.exists():
            collections_path.mkdir(mode=0o700)
        users_path = data_path / "users"
        if not users_path.exists():
            create_users_file(users_path, username, password, target_uid, target_gid)
        secure_directory(data_path, target_uid, target_gid)
        secure_directory(collections_path, target_uid, target_gid)
        return data_path, lock_descriptor
    except Exception:
        os.close(lock_descriptor)
        raise


def absolute_path(value, label):
    path = Path(value)
    if not path.is_absolute() or "\n" in str(path) or "\r" in str(path):
        raise RuntimeError(f"{label.capitalize()} path is invalid.")
    return path


def required(env, name):
    value = env.get(name, "")
    if not value:
        raise RuntimeError(f"{name} must be set.")
    return value


def validate_credentials(username, password):
    if not USERNAME_PATTERN.fullmatch(username):
        raise RuntimeError("RADICALE_USERNAME has an invalid format.")
    if not 16 <= len(password.encode()) <= 72:
        raise RuntimeError("RADICALE_PASSWORD must contain 16 to 72 UTF-8 bytes.")


def require_directory(path, label):
    metadata = path.lstat()
    if not stat.S_ISDIR(metadata.st_mode) or stat.S_ISLNK(metadata.st_mode):
        raise RuntimeError(f"{label} has an unsafe type.")


def lock_directory(path):
    flags = os.O_RDONLY | getattr(os, "O_DIRECTORY", 0) | getattr(os, "O_NOFOLLOW", 0)
    descriptor = os.open(path, flags)
    try:
        fcntl.flock(descriptor, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError as error:
        os.close(descriptor)
        raise RuntimeError("Another calendar instance already owns this volume.") from error
    os.set_inheritable(descriptor, True)
    return descriptor


def preflight(data_path, username, password, target_uid, target_gid):
    allowed_names = {"collections", "users"}
    stale_paths = []
    names = set()
    for entry in data_path.iterdir():
        if entry.name.startswith(".users-bootstrap-"):
            if stale_paths:
                raise RuntimeError("Calendar data contains multiple stale bootstrap files.")
            inspect_secure_file(entry, {0, target_uid}, {0, target_gid})
            stale_paths.append(entry)
        elif entry.name not in allowed_names:
            raise RuntimeError("Calendar data contains an unexpected root entry.")
        else:
            names.add(entry.name)

    collections_path = data_path / "collections"
    users_path = data_path / "users"
    has_collections = "collections" in names
    has_users = "users" in names
    collection_entries = None
    if has_collections:
        require_directory(collections_path, "Calendar collections")
        metadata = collections_path.lstat()
        owner = (metadata.st_uid, metadata.st_gid)
        if owner != (target_uid, target_gid) and (owner != (0, 0) or os.geteuid() != 0):
            raise RuntimeError("Calendar volume ownership requires an approved offline migration.")
        if owner == (target_uid, target_gid) and stat.S_IMODE(metadata.st_mode) != 0o700:
            raise RuntimeError("Calendar storage permissions are unsafe.")
        collection_entries = next(collections_path.iterdir(), None)
    if has_users:
        contents = inspect_secure_file(users_path, {target_uid}, {target_gid}, read=True)
        validate_users_file(contents, username, password)
    is_recoverable_bootstrap = not collection_entries
    data_metadata = data_path.lstat()
    if (data_metadata.st_uid, data_metadata.st_gid) != (target_uid, target_gid):
        if (data_metadata.st_uid, data_metadata.st_gid) != (0, 0) or os.geteuid() != 0 or not is_recoverable_bootstrap:
            raise RuntimeError("Calendar volume ownership requires an approved offline migration.")
    elif stat.S_IMODE(data_metadata.st_mode) != 0o700:
        raise RuntimeError("Calendar data permissions are unsafe.")

    if collection_entries:
        if not has_users:
            raise RuntimeError("Existing calendar collections require recovered credentials.")
        validate_collection_tree(collections_path, target_uid, target_gid)
    return {"stale_bootstrap_files": stale_paths}


def validate_collection_tree(root, target_uid, target_gid):
    for path in chain((root,), root.rglob("*")):
        metadata = path.lstat()
        if stat.S_ISLNK(metadata.st_mode) or not (stat.S_ISDIR(metadata.st_mode) or stat.S_ISREG(metadata.st_mode)):
            raise RuntimeError("Calendar storage contains an unsafe file type.")
        if (metadata.st_uid, metadata.st_gid) != (target_uid, target_gid):
            raise RuntimeError("Calendar volume ownership requires an approved offline migration.")
        expected_mode = 0o700 if stat.S_ISDIR(metadata.st_mode) else 0o600
        if stat.S_IMODE(metadata.st_mode) != expected_mode:
            raise RuntimeError("Calendar storage permissions are unsafe.")


def inspect_secure_file(path, allowed_uids, allowed_gids, read=False):
    descriptor = os.open(path, os.O_RDONLY | os.O_NONBLOCK | getattr(os, "O_NOFOLLOW", 0))
    try:
        metadata = os.fstat(descriptor)
        if not stat.S_ISREG(metadata.st_mode) or stat.S_IMODE(metadata.st_mode) != 0o600:
            raise RuntimeError("Calendar credential state has unsafe permissions or type.")
        if metadata.st_uid not in allowed_uids or metadata.st_gid not in allowed_gids:
            raise RuntimeError("Calendar credential ownership requires an approved offline migration.")
        if read:
            if metadata.st_size > MAX_USERS_FILE_BYTES:
                raise RuntimeError("Calendar credential state is not canonical.")
            with open(descriptor, "rb", closefd=False) as handle:
                return handle.read(MAX_USERS_FILE_BYTES + 1)
    finally:
        os.close(descriptor)


def validate_users_file(contents, username, password):
    lines = contents.splitlines()
    if len(contents) > MAX_USERS_FILE_BYTES or len(lines) != 1 or contents != lines[0] + b"\n":
        raise RuntimeError("Calendar credential state is not canonical.")
    stored_user, separator, password_hash = lines[0].partition(b":")
    if not BCRYPT_HASH_PATTERN.fullmatch(password_hash):
        raise RuntimeError("Calendar credential state is not canonical.")
    try:
        matches = separator and stored_user == username.encode() and bcrypt.checkpw(password.encode(), password_hash)
    except ValueError:
        matches = False
    if not matches:
        raise RuntimeError("Persisted calendar credentials do not match the configured identity.")


def create_users_file(path, username, password, target_uid, target_gid):
    temporary_path = path.parent / f".users-bootstrap-{secrets.token_hex(12)}"
    flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_NOFOLLOW", 0)
    descriptor = os.open(temporary_path, flags, 0o600)
    try:
        with os.fdopen(descriptor, "wb") as handle:
            secure_descriptor(handle.fileno(), 0o600, target_uid, target_gid)
            password_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=12))
            handle.write(username.encode() + b":" + password_hash + b"\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.link(temporary_path, path, follow_symlinks=False)
        fsync_directory(path.parent)
    finally:
        temporary_path.unlink(missing_ok=True)


def secure_descriptor(descriptor, mode, target_uid, target_gid):
    metadata = os.fstat(descriptor)
    if (metadata.st_uid, metadata.st_gid) != (target_uid, target_gid):
        os.fchown(descriptor, target_uid, target_gid)
    os.fchmod(descriptor, mode)


def secure_directory(path, target_uid, target_gid):
    flags = os.O_RDONLY | getattr(os, "O_DIRECTORY", 0) | getattr(os, "O_NOFOLLOW", 0)
    descriptor = os.open(path, flags)
    try:
        secure_descriptor(descriptor, 0o700, target_uid, target_gid)
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def fsync_directory(path):
    descriptor = os.open(path, os.O_RDONLY | getattr(os, "O_DIRECTORY", 0))
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def parse_number(env, name, default, minimum, maximum):
    try:
        value = int(env.get(name, default))
    except ValueError as error:
        raise RuntimeError(f"{name} must be an integer.") from error
    if not minimum <= value <= maximum:
        raise RuntimeError(f"{name} is outside its supported range.")
    return value


def validate_runtime_identity(euid, egid, groups):
    if euid != 0 and (euid != SERVICE_UID or egid != SERVICE_GID or any(group != SERVICE_GID for group in groups)):
        raise RuntimeError("Calendar runtime must start as root or the dedicated service identity.")


def require_persistent_volume(path):
    if not path.is_mount():
        raise RuntimeError("Calendar data must be backed by a mounted persistent volume.")
