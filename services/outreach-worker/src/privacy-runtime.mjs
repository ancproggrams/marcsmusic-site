import { loadPrivacyConfig } from "./privacy-config.mjs";
import { loadPrivacyPolicy } from "./domain/privacy-policy.mjs";
import { CryptoBox } from "./infrastructure/crypto-box.mjs";
import { createPostgresPool } from "./infrastructure/postgres.mjs";
import { PrivacyGovernanceRepository } from "./infrastructure/privacy-governance-repository.mjs";
import { createPrivacyGovernanceService } from "./application/privacy-governance-service.mjs";
import { assertHashKeyAttestation } from "./infrastructure/hash-key-attestation.mjs";

export function createPrivacyRuntime(env = process.env) {
  const config = loadPrivacyConfig(env);
  const policy = loadPrivacyPolicy(env);
  const pool = createPostgresPool(config.database);
  const cryptoBox = new CryptoBox(config.crypto);
  const repository = new PrivacyGovernanceRepository({ pool, cryptoBox, database: config.database });
  const service = createPrivacyGovernanceService({ repository, cryptoBox, policy });
  const hashKeyAttestationCheck = () => assertHashKeyAttestation({
    pool,
    cryptoBox,
    bootstrapReference: config.crypto.hashKeyBootstrapReference,
    bootstrapConfirmation: config.crypto.hashKeyBootstrapConfirmation
  });
  return Object.freeze({ config, policy, pool, cryptoBox, repository, service, hashKeyAttestationCheck });
}
