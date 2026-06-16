# Radicale for MarcsMusic

This folder contains a minimal CalDAV/CardDAV server for `calendar.marcsmusic.nl`.

## Railway deployment

1. Create a new Railway service from this folder.
2. Add a persistent volume mounted at `/data`.
3. Create `/data/users` with a bcrypt htpasswd user.
4. Point `calendar.marcsmusic.nl` to the Railway service.
5. Create a calendar collection for the user, for example:

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
