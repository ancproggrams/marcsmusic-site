# New Platform Adapter Template

1. Add capability metadata in `src/domain/music/platform-capabilities.mjs`.
2. Create `src/infrastructure/music/platforms/<platform>.mjs`.
3. Register the adapter in `src/infrastructure/music/platforms/index.mjs`.
4. Add focused tests.
5. Run `npm run verify`.

```js
import { getPlatformCapability } from "../../../domain/music/platform-capabilities.mjs";
import { createPublicationResult } from "./result-helpers.mjs";

const capability = getPlatformCapability("platform_id");

export const platformAdapter = Object.freeze({
  capability,
  async publish({ release, artist, platformAccount, action, dryRun, env, fetch }) {
    if (dryRun) {
      return createPublicationResult({
        action,
        dryRun,
        status: "dry_run",
        message: "Describe the exact request that would be made.",
        request: {
          method: "POST",
          url: "https://provider.example/upload",
          requiredCredentialEnv: capability.requiredCredentialEnv
        }
      });
    }

    return createPublicationResult({
      action,
      dryRun,
      status: "blocked",
      message: "Implement official API execution only after credential and terms review."
    });
  }
});
```

Rules:

- Do not use password-based browser automation.
- Do not log provider tokens.
- Dry-run must not require credentials.
- Real execution must stay behind the API execution guard.
- Manual-only platforms should use `createManualPlatformAdapter`.

