# ADR-002: Identity, RBAC, tenancy, and service authentication

Status: proposed

## Context

Release OS is largely public, Growth OS lacks user/organization ownership, and shared bearer tokens do not provide human identity or least privilege.

## Decision

- Use standards-based OIDC with server-side opaque sessions for people.
- Model `User`, `Organization`, `Membership`, `Role`, `ServiceIdentity`, and `ServiceGrant`.
- Derive tenant context from membership or service grants, never request input.
- Support viewer, editor, publisher, campaign-sender, and administrator permissions.
- Enforce authorization per command/query; UI visibility is not a control.
- Require CSRF protection, valid Origin, and JSON content type for browser mutations.
- Give jobs distinct service identities, audiences, and minimum grants over private networking.
- Encrypt SoundCloud tokens with versioned authenticated encryption and bind one-time OAuth state to user and organization.
- Keep only minimal `/livez` public. Readiness, metrics, and management routes are internal or authenticated.

## Rejected for now

- A shared admin token as the final design.
- Tenant IDs supplied by clients.
- Custom password authentication or a separate auth microservice.

## Exit gates

Anonymous, cross-tenant, and per-role allow/deny contract tests must pass. Provider choice, production token rotation, and key migration require separate approval and runbooks.
