# MediKiosk website audit — 9 September 2026

Reviewed against the supplied patient-controlled longitudinal-record ideation. Changes preserve the existing page layout and existing uncommitted work. Tests used synthetic accounts in a separate PostgreSQL instance on localhost:55439; the configured database and real provider accounts were not used for test writes. No migrations were applied to the configured database.

## Fixed

| Area | Verified discrepancy | Change |
| --- | --- | --- |
| Document privacy | Doctor/staff roles bypassed ownership checks on records, OCR, original downloads, deletion and Q&A. | Patient ownership or explicit patient-issued, unexpired document permission is required. Staff are excluded. View and original-download permissions are separate. |
| Consent UI | `document_access` existed without a patient sharing workflow. | Document details now show connected doctors and allow private/view/download permissions. Revoking the relationship revokes grants; reconnecting does not resurrect them. |
| Clinical privacy | Receptionists could read unified patient history and AI summaries. | Staff see scheduling information for their assigned practice. Unified history requires an active patient-doctor relationship, and documents still require their own grants. |
| Clinical integrity | Backend OCR failures and ML extraction failures invented drugs, diagnoses and dates. | Preserve original text/files, mark OCR failure explicitly and leave unknown clinical facts empty. Removed automatic promotion of document diagnoses into confirmed medical-history rows. |
| Clinical display | Missing alerts were presented as proof of normal results; text lines became invented five-day medications. | Removed invented medication parsing and the unsupported normal-results assertion. |
| Storage | Upload failure silently fell back to local files; download fallback route did not exist; file-delete service did not exist. | Explicit development-only local storage, authenticated local-file download, encoded cloud paths, short-lived cloud URLs, actual original-file deletion and retrieval-copy cleanup. Storage cleanup failure keeps the database reference for retry. |
| Intake | Other patients could read or submit voice turns to a session; standalone sessions could not be fetched. | Patient-only routes, ownership checks and optional appointment joins. |
| Appointments | Any authenticated user could update another appointment. | Only assigned participants may change it; patients may cancel only. Closed appointments cannot be changed through this endpoint. |
| Booking | Directory form never provided the required completed assessment; it accepted a database-invalid visit type. | Select actual available slots and an eligible completed assessment; assessment linkage cannot be reused. |
| Scheduling | Past days appeared available; local server timezone changed displayed slot times; simultaneous overlapping bookings were possible. | Past slots disabled, explicit India clinic timezone, overlap-aware availability and a database exclusion constraint. |
| QR pairing | Two doctors could consume one QR code concurrently. | Atomic token consumption and relationship creation. |
| Authentication | Deactivated staff retained valid JWT access; public default JWT and WhatsApp secrets were accepted. | Check current account status and doctor verification on each authenticated request; remove predictable fallbacks. Production JWT configuration is required. |
| Doctor verification | Every doctor had platform approval authority. | Verification endpoints require an explicit platform-admin UUID allowlist. Clinic admin is not platform admin. |
| Staff accounts | API offered nurse/admin roles rejected by the schema; portal routing looped or linked to nonexistent role URLs. | Added role migration, supported staff portal access and consistent sidebar/topbar/account redirects. |
| Calls | Patients could forge doctor notes and prescriptions while ending calls or posting messages. | Restricted clinical note/prescription writes and system-message types; closed calls cannot be completed again. Removed tokenless retry after RTC authorization failure. |
| ML boundary | Direct service calls could supply arbitrary patient IDs. | Shared backend-to-ML key; fail closed in production without a key. Unconfigured development permits loopback only. Retrieval always includes patient and document filters together. |
| Frontend API contracts | Dashboard, calendar and appointment pages read snake_case fields from camelCase responses; history original-file button read `url` instead of `downloadUrl`. | Normalized appointment fields and corrected file links and assessment-summary display. |
| Misleading placeholders | Empty accounts showed fictitious appointments, messages, doctor ratings, experience, departments and room numbers. | Use actual records; remove invented values. Mail delivery, photo persistence, vitals and claims are unavailable or explicitly described as previews. Reminders disclose their temporary behavior. |
| UI controls | Profile buttons, directory sorting/profile view, landing anchor, mobile topbar and screen-share stop callback had failures. | Wired profile/sort controls, corrected navigation, constrained mobile header, and made screen-share cleanup explicit. |
| Repository | Two migration directories and a hardcoded migration runner encouraged partial schemas. | Canonical migrations remain in `supabase/migrations`; historical copies are documented, and manual execution requires an explicit filename. |

## Validation

- Production frontend build passes. The initial native Lightning CSS dependency failure was repaired locally.
- Frontend lint passes with **0 errors and 11 existing hook-dependency warnings**; warnings were not suppressed.
- **61 isolated API/database checks passed**, including ownership, consent, inactive-account restrictions, revocation, OCR outage, original deletion, QR concurrent use, database overlap rejection, nurse provisioning, and teleconsultation message permissions.
- **33 role/route combinations** loaded in headless Chrome without recorded JavaScript exceptions or failed API responses at the time of the final route pass.
- **15 browser interaction checks passed**: directory search/profile, booking with actual slots and a completed assessment, appointment filters, calendar navigation, temporary reminders, persistent patient profile edits, upload with failed OCR, QR regeneration, disabled mailbox delivery and staff account controls.
- **65 Python tests passed; 1 RAG integration test failed** because ChromaDB/model dependencies are unavailable in the temporary environment. The passing tests include mocked STT/TTS, clinical-engine and document-integrity checks. The earlier focused subset passed all 38 tests. Live voice providers and real vector retrieval were not exercised.
- The relational migrations were exercised in a temporary PostgreSQL database. That installation has no pgvector extension: the audit bootstrap substitutes `REAL[]` for the vector column. **This does not validate pgvector indexing, embedding quality or Supabase storage policies in deployment.** The overlap and RLS migrations were tested against real PostgreSQL constraints and roles.

## Required deployment work and limits

1. Review and apply the three new migrations using the normal deployment workflow. The overlap migration intentionally fails if existing active appointments overlap; resolve those records explicitly rather than deleting or rewriting them automatically. Test the RLS migration with the actual backend database role before rollout; custom application JWTs do not map to Supabase Auth users.
2. Configure trusted database TLS/CA, a strong JWT secret, matching backend/ML service keys, WhatsApp service key, platform verification administrators, private Supabase storage credentials and secure Agora configuration. Backend and ML changes need coordinated deployment. Existing sessions issued with the removed default secret will no longer authenticate.
3. The configured database's actual policies, grants, backups and storage contents were not inspected or changed. If earlier uploads used the fabricated OCR fallbacks, their existing derived records need a separately reviewed cleanup/reprocessing plan. This audit does not automatically rewrite patient records.
4. Live Google OAuth, SMS/email OTP delivery, WhatsApp delivery, cloud OCR/RAG quality, camera/microphone hardware and a two-device Agora call remain unverified. These require provider configuration and controlled end-to-end test accounts. No real messages were sent.
5. The architecture still uses a Chroma retrieval copy while PostgreSQL stores chunks; a complete pgvector-only pipeline remains a separate implementation task. Deleting a successfully processed record requires ML retrieval cleanup to be reachable. Deleted IDs are filtered out of search responses as an additional protection.
6. The general mailbox, persistent calendar reminders/notifications, saved profile photos, direct vitals entry and insurance claims are not implemented. Medical-ID “add” actions still lead to the assessment workflow rather than dedicated structured CRUD forms. These limitations should not be advertised as completed features.
7. This is a code, relational-database and targeted browser audit, **not proof that every possible button/state/device/provider combination works** or a certification of healthcare compliance. Additional production work includes deployment-level rate limits, audit trails, retention/recovery policies and a formal consent review.
8. Performance remains an improvement area: the production JS bundle and several hero images are large. Route splitting and image optimization were not mixed into the privacy fixes.

## Reproducing the isolated checks

Files are under `backend/src/tests/audit/` and `ML/tests/test_document_integrity.py`. `setup.cjs` only accepts `postgresql://audit@127.0.0.1:55439/medikiosk_audit` and refuses to overwrite an existing audit database. `security.cjs` creates synthetic fixtures and saves temporary browser tokens in `/private/tmp/medikiosk-audit-fixtures.json` with mode 0600. It does not clean or mutate a deployed database. Browser scripts require Playwright, local Chrome and the isolated frontend/backend on ports 55173/55019. The browser route script records observations; the interaction script asserts outcomes.

Example after starting the separate audit database and running setup:

```sh
TEST_DATABASE_URL=postgresql://audit@127.0.0.1:55439/medikiosk_audit node backend/src/tests/audit/security.cjs
PYTHON_DOTENV_DISABLED=1 GROQ_API_KEY= SARVAM_API_KEY= PYTHONPATH=ML python -m pytest ML/tests/test_document_integrity.py ML/tests/test_clinical_engine.py -q
```
