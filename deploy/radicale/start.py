import os
from pathlib import Path

import bcrypt


port = os.environ.get("PORT", "5232")
username = os.environ.get("RADICALE_USERNAME")
password = os.environ.get("RADICALE_PASSWORD")

if not username or not password:
    raise RuntimeError("RADICALE_USERNAME and RADICALE_PASSWORD must be set.")

data_path = Path("/data")
collections_path = data_path / "collections"
users_path = data_path / "users"
config_path = Path("/tmp/radicale-config")

collections_path.mkdir(parents=True, exist_ok=True)
password_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
users_path.write_text(f"{username}:{password_hash}\n", encoding="utf-8")
users_path.chmod(0o600)

config_path.write_text(
    f"""[server]
hosts = 0.0.0.0:{port}

[auth]
type = htpasswd
htpasswd_filename = {users_path}
htpasswd_encryption = bcrypt

[storage]
filesystem_folder = {collections_path}

[rights]
type = owner_only

[web]
type = internal

[logging]
level = info
""",
    encoding="utf-8",
)

os.execvp("radicale", ["radicale", "--config", str(config_path)])
