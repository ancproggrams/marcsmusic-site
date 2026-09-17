# ISO/IEC 27001:2022, ISO/IEC 27701:2025 and NIS2 alignment limitations

## Status statement

The outreach design contains controls that can support an information-security and privacy management system. This orientation uses the current published editions [ISO/IEC 27001:2022](https://www.iso.org/standard/27001) and [ISO/IEC 27701:2025](https://www.iso.org/standard/27701); the latter replaced the withdrawn 2019 edition and can operate as a standalone PIMS management-system standard. The repository is **not** ISO/IEC 27001 or ISO/IEC 27701 certification, a NIS2 conformity assessment, an audit opinion, legal advice, a DPIA, a lawful-basis determination or proof that controls operate effectively.

Do not use “ISO compliant,” “ISO certified,” “NIS2 compliant,” “GDPR compliant” or equivalent claims based on this code or document. Formal claims require an approved management system, defined scope, risk assessment, Statement of Applicability where applicable, operating evidence and independent competent assessment against the organization’s licensed/adopted edition of each standard. NIS2 applicability and duties must be assessed against the Directive and applicable national implementation for the legal entity and services in scope.

## Control-design contribution

| Control objective | Repository contribution | What it does not prove |
| --- | --- | --- |
| Asset and data ownership | [Source-of-truth contract](source-of-truth.md) assigns authoritative owners and projections. | Complete enterprise inventory, classification approval or accountable business ownership. |
| Least privilege and authentication | Separate API/provider credentials, signed webhooks, protected metrics, fail-closed startup. | Actual role grants, joiner/mover/leaver operation, MFA, quarterly access review or secret exposure absence. |
| Secure configuration and change | Validated environment, versioned migrations, tests, safe defaults, reviewed `main` deployment expectation. | Branch protection, reviewer independence, CI provenance, release approval or configuration drift monitoring. |
| Cryptography | AES-256-GCM with associated data; keyed HMAC privacy hashes; purpose-separated secrets. | Approved key inventory, HSM/KMS custody, dual control, rotation completion, backup-key recovery or algorithm policy approval. |
| Logging and monitoring | Structured/redacted logs, correlation IDs, metrics, alerts and incident procedures. | Central log immutability, access restriction, retention, alert routing, response times or 24/7 monitoring operation. |
| Resilience | Durable queues, idempotency, bounded retries, leases, circuit breaker, uncertainty state and rollback runbook. | Measured SLOs, load capacity, multi-region recovery, provider SLA, backup success or restore time objectives. |
| Secure development | Domain boundaries, deterministic policy, hermetic tests, migration/release gates. | SAST/SCA results, vulnerability remediation SLA, penetration test, SBOM, developer training or supply-chain attestation. |
| Controlled legacy migration | `legacy-leads-v2` provides stable ordering, full-source digests, explicit digest-bound approval, restart checkpoints, reconciliation and contact-linked historical events. | Source-data correctness, legal permission to contact, independent approval operation, production execution success or complete records-governance evidence. |
| Incident management | Emergency stop, preservation, escalation and post-incident checklist. | Exercised plan, named/current contacts, regulatory notification decisions or completed lessons learned. |
| Privacy by design/default | Data minimization, encrypted payloads, deny-wins suppression, confirmed opt-out, evidence-gated contact. | Lawful basis, ePrivacy/direct-marketing permissibility, transparent notice, purpose compatibility or necessity/proportionality. |
| Data-subject rights | Unsubscribe path and business suppression model. | Identity-verification procedure, access/correction/deletion/objection workflow, response deadlines or case evidence. |
| Processor/vendor governance | Explicit EspoCRM, Railway and Mailgun boundaries; EU Mailgun endpoint default. | Signed DPAs, subprocessor review, transfer mechanism, residency verification, vendor risk assessment or exit plan. |
| Retention and deletion | Retention is identified as a mandatory production decision; raw PII stays in EspoCRM where practical. | Approved schedule, automated deletion, legal holds, backup deletion or proof of execution. |

## Orientation mapping — not a Statement of Applicability

The references below are navigation aids for an accountable control owner. They are not a complete control set, legal conclusion, gap assessment or Statement of Applicability. Use the organization’s licensed [ISO/IEC 27001:2022](https://www.iso.org/standard/27001) and [ISO/IEC 27701:2025](https://www.iso.org/standard/27701) texts and the official [Directive (EU) 2022/2555](https://eur-lex.europa.eu/eli/dir/2022/2555/oj); do not assess conformity from this summary.

| Repository design/evidence | ISO/IEC 27001:2022 orientation | NIS2 orientation | Remaining organizational evidence |
| --- | --- | --- | --- |
| Defined EspoCRM/PostgreSQL ownership, inventory boundary and named approvers | Clauses 4–6; Annex A 5.2, 5.9, 5.12 | Article 20 governance; Article 21(2)(a), (i) | Legal-entity scope, risk owners, full asset register, classification and approved treatment plan. |
| Least-privilege API identities, secret separation, protected metrics and fail-closed startup | Annex A 5.15–5.18; 8.2, 8.5 | Article 21(2)(i), (j) | Actual grants, MFA where appropriate, access reviews, service-account lifecycle and revocation evidence. |
| Encrypted technical payloads, keyed hashes and signed webhooks | Annex A 8.24; 5.14 | Article 21(2)(h), (j) | Approved cryptographic policy, key custody/rotation, secure communications inventory and recovery test. |
| Versioned migrations, tests, staging/restored-DB promotion and reviewed change | Annex A 8.25–8.33 | Article 21(2)(e), (f) | Protected CI provenance, vulnerability handling, review independence, SBOM/SCA and production change approvals. |
| `legacy-leads-v2` snapshot/report digests, stable cursor, approval envelope, checkpoints and reconciliation | Annex A 5.33; 8.10, 8.15, 8.32 | Article 21(2)(e), (f) | Accountable approval identities, protected report/change record, production run evidence, source quality decision and approved retention/deletion treatment. |
| Durable queues, leases, idempotency, bounded retries, circuit and `delivery_unknown` | Annex A 5.29, 5.30; 8.6, 8.14 | Article 21(2)(b), (c) | Business-impact analysis, capacity tests, approved continuity plan, exercised crisis management and measured recovery objectives. |
| Backups and isolated restore-before-cutover procedure | Annex A 8.13; 5.30 | Article 21(2)(c) | Backup configuration, retention, encryption, restore logs, recovery ownership and evidence that RPO/RTO are met. |
| Redacted structured logs, correlation IDs, metrics, SLOs, alerts and incident checklist | Annex A 5.24–5.28; 8.15, 8.16 | Article 21(2)(b), (f); Article 23 | Central immutable retention, tested paging, trained responders, legal reporting decision tree and notification records. |
| Provider boundaries for Railway, EspoCRM, Mailgun and optional AI | Annex A 5.19–5.23 | Article 21(2)(d), (e) | Supplier risk reviews, contracts/DPAs, vulnerability and incident clauses, subprocessor/transfer review and exit exercises. |
| Evidence-gated contact, minimization, unsubscribe and deny-wins suppression | Annex A 5.31, 5.33, 5.34 | Article 21 risk-proportionality context; other privacy/ePrivacy law remains separate | Lawful-basis/direct-marketing analysis, privacy notice, rights procedure, retention decision and operating case evidence. |
| Documented runbook, security responsibilities and required exercises | Clauses 7–10; Annex A 6.3, 5.36 | Article 20; Article 21(2)(f), (g) | Training, exercise attendance/results, internal audit, management review, corrective action and continual-improvement evidence. |

NIS2 Article 23 reporting cannot be implemented by an application runbook alone. The organization needs a jurisdiction-specific escalation and notification process, competent-authority/CSIRT contacts, decision ownership, legally reviewed timelines and exercised evidence. The application must preserve timestamps and redacted incident evidence so that process can operate.

## Required evidence outside Git

Production approval needs at least:

- approved ISMS/PIMS scope, owners, policies, risk register/treatment and applicable control mapping;
- documented NIS2 scope/applicability decision, management-body oversight and national incident-reporting procedure where applicable;
- records of processing, data-flow inventory, data classification and retention schedule;
- documented campaign purpose, target population, lawful-basis and direct-marketing/ePrivacy analysis by qualified privacy/legal ownership;
- legitimate-interest assessment where relied upon, plus objection and balancing safeguards;
- privacy notice and traceable source/evidence standards for publicly listed business contacts;
- DPIA screening and DPIA if required by scale, profiling, automation or local interpretation;
- processor agreements, subprocessor list, transfer/residency assessment and vendor exit/continuity plans for Railway, EspoCRM hosting, Mailgun and any AI provider;
- production access grants, MFA proof, periodic review, service-account ownership and credential/key lifecycle records;
- protected CI results, dependency/SBOM/vulnerability evidence, change approvals and deployment provenance;
- backup schedules, successful restore exercises and measured recovery objectives;
- monitoring history, alert tests, on-call assignments and incident/tabletop exercise evidence;
- data-subject request, unsubscribe, complaint, suppression and breach-response procedures with case evidence;
- deletion/anonymization job evidence, backup-retention treatment and legal-hold procedure;
- independent audit/certification evidence if a certification claim is intended.

Never store the evidence set itself in a broadly readable repository if it contains personal data, security-sensitive diagrams, access lists, provider contracts or secrets. Link to the controlled governance system using non-sensitive identifiers.

## Privacy decisions that code cannot make

An email address published for business contact can still be personal data. “Publicly available,” “B2B,” “relevant genre,” a high match score or an AI confidence value does not by itself establish permission or lawful basis for unsolicited email. Jurisdiction, recipient role, message purpose, frequency and local electronic-communications rules matter.

Before enabling production sending, accountable privacy/legal ownership must decide and document:

1. which countries and recipient roles are in scope;
2. the lawful basis and separate direct-marketing rule for each scope;
3. minimum acceptable source/evidence and its refresh interval;
4. transparency timing and notice content;
5. objection, unsubscribe, complaint and data-subject-right handling;
6. retention/deletion and suppression-retention rationale;
7. whether automated matching/copy or scale triggers a DPIA or additional safeguards.

The worker intentionally treats uncertainty as a denial or human-review state.

## AI-specific evidence

If the copy provider is enabled, retain approved evidence for provider terms/DPA, data location/transfers, subprocessor list, training-use controls, prompt/data minimization, model/version change process, incident notification and human oversight. The provider must receive only the minimum structured facts needed for copy.

Tests that reject invented claims, unknown evidence IDs, unapproved URLs, excess calls-to-action and missing unsubscribe links demonstrate validator design. They do not prove that every historical or future provider response was reviewed correctly. Production telemetry must record model/prompt/template version, validation outcome and immutable content hash without logging the message body.

## Evidence quality rules

- Identify control owner, system scope, collection period, source and reviewer.
- Prefer system-generated, tamper-evident records over screenshots.
- A test pass proves one execution on one revision; it is not continuous operating effectiveness.
- A policy proves intent; samples and time-bounded records prove operation.
- A dashboard existing is not evidence that alerts reach a responder.
- Encryption at rest is not proof of key governance or data minimization.
- A backup job succeeding is not proof of restorability.
- Redact/minimize PII while keeping correlation and integrity evidence.

## Production compliance gate

The campaign remains disabled until the engineering owner, campaign owner and privacy/security owner each approve their domain, with dated evidence references. Any material change to recipients, countries, purpose, provider, AI data flow, retention, scale or automatic response behavior reopens the assessment.
