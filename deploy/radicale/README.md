# Radicale for MarcsMusic

This folder contains a minimal Railway-hosted CalDAV/CardDAV server for MarcsMusic.

## Railway deployment

1. Create a new Railway service from this folder.
2. Add a persistent volume mounted at `/data`.
3. Set `PORT=5232`.
4. Set `RADICALE_USERNAME` and `RADICALE_PASSWORD` as Railway secrets.
5. Deploy this folder. `start.py` creates `/data/users` with a bcrypt htpasswd user.
6. Point `calendar.marcsmusic.nl` to the Railway service, or use the generated Railway domain.
7. Create a calendar collection for the user, for example:

```text
https://calendar.marcsmusic.nl/marcsmusic/bookings/
```

Use these values in the MarcsMusic website backend:

```text
CALDAV_BASE_URL=https://calendar.marcsmusic.nl
CALDAV_USERNAME=marcsmusic
CALDAV_PASSWORD=...
CALDAV_CALENDAR_PATH=/marcsmusic/bookings/
```

For Android, use DAVx5. For iPhone/macOS, add a CalDAV account in system settings.
