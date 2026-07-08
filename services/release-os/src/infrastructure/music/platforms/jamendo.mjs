import { getPlatformCapability } from "../../../domain/music/platform-capabilities.mjs";
import { createManualTask, createPublicationResult, workflow } from "./result-helpers.mjs";

const capability = getPlatformCapability("jamendo");
const jamendoWorkflow = workflow("api_contract_check", "https://devportal.jamendo.com/", [
  "Confirm the current Jamendo read/write API plan and upload terms.",
  "Verify whether this artist account can create releases through API access.",
  "Only enable automation after upload semantics, rights terms, and rate limits are documented.",
  "Until then, use Jamendo's artist upload workflow manually."
]);

export const jamendoAdapter = Object.freeze({
  capability,
  async publish({ release, action, dryRun, artist }) {
    return createPublicationResult({
      action,
      dryRun,
      status: "blocked",
      message: "Jamendo requires API/write-access confirmation before automation.",
      manualTask: createManualTask(capability, release, action, jamendoWorkflow, { artist })
    });
  }
});

