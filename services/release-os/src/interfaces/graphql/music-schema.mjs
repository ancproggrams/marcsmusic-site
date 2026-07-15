import { graphql, buildSchema } from "graphql";
import {
  getPlatformCapability,
  listPlatformCapabilities
} from "../../domain/music/platform-capabilities.mjs";
import { createReleasePlan } from "../../application/music/release-planner.mjs";
import { publishRelease as executePublication } from "../../application/music/publication-service.mjs";

const schema = buildSchema(`
  type PlatformCapability {
    id: ID!
    name: String!
    category: String!
    observedOnRailway: Boolean!
    credentialEnvPrefix: String!
    officialApiStatus: String!
    uploadSupport: String!
    canAutoPost: Boolean!
    authType: String!
    apiUrl: String
    postingModes: [String!]!
    requiredCredentialEnv: [String!]!
    requirements: [String!]!
    notes: [String!]!
  }

  type RetryPolicy {
    maxAttempts: Int!
    backoff: String!
  }

  type PlatformAction {
    platformId: ID!
    platformName: String!
    idempotencyKey: String!
    mode: String!
    supportLevel: String!
    operation: String!
    status: String!
    reason: String!
    officialApiStatus: String!
    uploadSupport: String!
    requiredCredentialEnv: [String!]!
    requirements: [String!]!
    retryPolicy: RetryPolicy!
    apiUrl: String
  }

  type ReleasePlanSummary {
    total: Int!
    apiUploadReady: Int!
    manualUploadRequired: Int!
    distributorDeliveryRequired: Int!
    researchRequired: Int!
  }

  type ReleasePlan {
    releaseId: ID!
    title: String!
    artist: String!
    audioSource: String!
    coverArtSource: String
    releaseDate: String
    status: String!
    summary: ReleasePlanSummary!
    actions: [PlatformAction!]!
  }

  input ReleasePlanInput {
    releaseId: ID
    title: String!
    artist: String!
    audioSource: String!
    coverArtSource: String
    videoSource: String
    description: String
    releaseDate: String
    targetPlatforms: [ID!]
  }

  input PublicationInput {
    releaseId: ID
    title: String!
    artist: String!
    audioSource: String!
    coverArtSource: String
    videoSource: String
    description: String
    genre: String
    tags: [String!]
    releaseDate: String
    visibility: String
    primaryReleaseUrl: String
    targetPlatforms: [ID!]
  }

  type PublicationSummary {
    total: Int!
    dryRun: Int!
    submitted: Int!
    manualTask: Int!
    blocked: Int!
    failed: Int!
    inProgress: Int!
    reconciliationRequired: Int!
  }

  type PublicationRequest {
    method: String
    url: String
    auth: String
    operation: String
    apiUrl: String
    docs: String
    sdk: String
    formFields: [String!]
    steps: [String!]
    requiredCredentialEnv: [String!]
  }

  type ManualTaskFields {
    releaseId: ID!
    title: String!
    artist: String!
    audioSource: String!
    coverArtSource: String
    description: String
    genre: String
    tags: [String!]!
    releaseDate: String
    visibility: String!
    primaryReleaseUrl: String
  }

  type ManualTask {
    id: ID!
    kind: String!
    title: String!
    url: String
    credentialEnvPrefix: String!
    steps: [String!]!
    fields: ManualTaskFields!
  }

  type PublicationResult {
    platformId: ID!
    platformName: String!
    idempotencyKey: String!
    mode: String!
    operation: String!
    status: String!
    dryRun: Boolean!
    message: String!
    externalId: String
    externalUrl: String
    errorCode: String
    retryable: Boolean
    outcomeUncertain: Boolean
    reconciled: Boolean
    requiredCredentialEnv: [String!]!
    requirements: [String!]!
    request: PublicationRequest
    manualTask: ManualTask
  }

  type PublicationBatch {
    releaseId: ID!
    title: String!
    artist: String!
    dryRun: Boolean!
    status: String!
    targetPlatforms: [ID!]!
    summary: PublicationSummary!
    plan: ReleasePlan!
    results: [PublicationResult!]!
  }

  type Query {
    platforms(observedOnly: Boolean, autoPostOnly: Boolean): [PlatformCapability!]!
    platform(id: ID!): PlatformCapability
  }

  type Mutation {
    planRelease(input: ReleasePlanInput!): ReleasePlan!
    publishRelease(input: PublicationInput!, dryRun: Boolean = true): PublicationBatch!
  }
`);

const rootValue = Object.freeze({
  platforms({ observedOnly = false, autoPostOnly = false } = {}) {
    return listPlatformCapabilities({ observedOnly, autoPostOnly });
  },

  platform({ id }) {
    return getPlatformCapability(id);
  },

  planRelease({ input }) {
    return createReleasePlan(input);
  },

  publishRelease({ input, dryRun = true }, context = {}) {
    if (dryRun === false && !context.allowExecution) {
      throw new Error("Real music publication requires a valid x-music-api-token header.");
    }

    const publicationExecutor = context.publicationService?.publish ?? executePublication;
    return publicationExecutor(input, {
      dryRun,
      env: context.env,
      fetch: context.fetch,
      mediaRootDir: context.mediaRootDir
    });
  }
});

export async function executeMusicGraphQuery({ query, variables, operationName, contextValue }) {
  if (typeof query !== "string" || !query.trim()) {
    throw new TypeError("GraphQL query is required");
  }

  return graphql({
    schema,
    source: query,
    rootValue,
    variableValues: variables,
    operationName,
    contextValue
  });
}

export { schema as musicGraphSchema };
