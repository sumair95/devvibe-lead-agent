# DevVibe lead-generation agent

Technical build reference and recovery guide | 9 October 2026 | Version 1.0

## 1. Evidence, scope and current outcome

This guide records the available DevVibe n8n build history and provides a reconstruction guide for the complete system requested by the owner. It deliberately contains no credentials or prospect records.

**Evidence labels:** VERIFIED means directly recoverable from the latest conversation; OWNER SCOPE means specified by the owner in this documentation request; RECONSTRUCTION means a safe implementation reference whose historical configuration was not recoverable; PLANNED means remaining work, not an implemented feature.

The referenced conversation, “Find Local Leads”, returned five recent exchanges and no older-page cursor. No original n8n workflow exports, VPS configuration, full Data Table export or earlier project transcript was available. Consequently, this is not a certified export of the deployed instance. Earlier setup steps, original schema types, original threshold, model/version, exact callback format, installed n8n version and individual website-cleaning fixes cannot be asserted as historical facts. They are documented below with their evidence labels. To complete historical fidelity, reconcile this guide against sanitized exports and the earlier transcript.

VERIFIED current outcome: the owner reported processing another business, calculating its score, receiving Telegram approval and sending an email. A second approval did not send another email because the row was already EMAIL_SENT / APPROVED. This establishes sequential duplicate-click protection in the tested path; it does not establish protection against simultaneous executions or prove recipient inbox delivery.

VERIFIED fixes: Get New Lead filter rebuilt; website test separated; Save Outreach Draft writes PENDING_APPROVAL; deterministic score inserted after parsing; qualification uses >=65; rejected analysis leaves NEW. The user’s final success report does not independently verify every branch or timestamp write. Reject/DNC, IMAP, follow-ups, continuous loops and observability remain PLANNED.

## 2. Architecture: original intent and current design

OWNER SCOPE: Hostinger VPS hosts n8n. Google Places discovers businesses. The devvibe_leads Data Table is the operational record. Website research feeds an OpenAI opportunity analyst and outreach writer. Telegram is the human review gate. Titan SMTP sends approved messages.

RECONSTRUCTION of original intent: split discovery, enrichment and approval into separate workflows, with shared persistent state rather than a single execution waiting indefinitely for approval. This makes review asynchronous and allows each stage to resume from the table.

Current logical architecture:

```text
Niche/location queue -> Workflow 01 Lead Scout -> devvibe_leads [NEW]
                                                  |
Workflow 02: Get New Lead -> Has Website? -> Fetch/Clean Website
 -> Build Research URLs -> Fetch Research Pages -> Combine Business Research
 -> AI Opportunity Analyst -> Parse AI Analysis -> Calculate Lead Score
 -> Is Qualified Lead?
    TRUE: Save AI Analysis [AI_QUALIFIED] -> AI Outreach Writer
          -> Parse Outreach Email -> Save Outreach Draft
          [EMAIL_READY / PENDING_APPROVAL] -> Send Approval Request
    FALSE: Mark Lead Not Qualified [AI_NOT_QUALIFIED] -> Stop

Telegram callback -> Workflow 03 Telegram Approval Handler
 -> Parse callback -> Switch -> APPROVE -> Reload lead -> Can Send Email?
 -> Claim [SENDING / APPROVED] -> Titan SMTP -> Save success
 [EMAIL_SENT / APPROVED; first_email_sent_at]
```

The queue and research stages above reflect OWNER SCOPE; exact node exports were unavailable. The named scoring, parsing, qualification and draft nodes are VERIFIED. Approval-handler ordering is a RECONSTRUCTION of the required send controls, supported by the reported result.

Important: PENDING_APPROVAL belongs to approval_status. It is not a separate value in the status chain. Keep these two dimensions separate.

## 3. Hostinger VPS and n8n setup

OWNER SCOPE confirms the hosting choice, not the VPS plan, OS, installation method, domain or database engine. Do not infer those details from this guide.

RECONSTRUCTION checklist:

1. Record the VPS plan, OS, resources, installed n8n version and installation method privately. If a Hostinger template already installed n8n, inspect it before adding another instance.
2. Point an automation subdomain at the VPS using private deployment records. Put a TLS reverse proxy in front of n8n and make the public webhook URL match that HTTPS origin.
3. Use persistent storage for n8n data and its credential encryption key. Back up both the database and key outside the repository. A database restore without the correct encryption key may make credentials unusable.
4. Set N8N_HOST, N8N_PROTOCOL, WEBHOOK_URL and N8N_EDITOR_BASE_URL consistently with the public origin. Configure N8N_PROXY_HOPS for the actual proxy topology, not an assumed number.
5. Set GENERIC_TIMEZONE and TZ to Australia/Sydney where Sydney business-day scheduling is intended. Configure the workflow timezone as well.
6. Choose and record the internal database deliberately. Data Tables are a product feature; they do not prove PostgreSQL was deployed. Retain the existing engine until a tested migration is needed.
7. Create n8n credentials for Google, OpenAI, Telegram and Titan using the credential UI. Do not paste tokens into Code nodes or workflow JSON.
8. Publish/activate the callback workflow, verify its production webhook, and use a dedicated test bot when testing would replace the production Telegram webhook.
9. Pin the deployed n8n version, take backups before upgrades and run the acceptance checks in section 15 after changes.

The sample environment file is a checklist, not a deployable Hostinger stack. It intentionally contains no passwords or encryption key. Current installation guidance: https://docs.n8n.io/deploy/host-n8n/install-options/install-using-docker-compose.md

## 4. devvibe_leads Data Table contract

VERIFIED column names: google_place_id, website, status, approval_status, lead_score, observed_signal, pain_hypothesis, automation_opportunity, email, email_subject, email_body. first_email_sent_at appears in the recommended test and owner scope, but its successful persisted value was not shown. The full original schema is unavailable.

The following is a RECONSTRUCTION schema contract. Confirm column names/types in the live table before applying expressions. Use JSON-encoded text for lists if the Data Table does not support array/object columns. n8n system row IDs and system timestamps are separate from these application fields.

| Column | Intended type | Purpose / evidence |
| --- | --- | --- |
| google_place_id | String | Stable business identity; VERIFIED match key |
| business_name | String | Business display name; reconstruction |
| niche, location | String | Discovery provenance; reconstruction |
| website | String | Public website; VERIFIED |
| business_phone, business_address | String | Optional business metadata; reconstruction, never include live data in samples |
| status | String | Operational stage; VERIFIED |
| approval_status | String | Human-review stage; VERIFIED |
| lead_score | Number | Deterministic 0-100; VERIFIED |
| observed_signal | String | JSON.stringify(observed_facts); VERIFIED |
| pain_hypothesis | String | Explicitly a hypothesis; VERIFIED |
| automation_opportunity | String | Evidence-based offer idea; VERIFIED |
| email | String | Selected public business email; VERIFIED |
| email_subject, email_body | String | Persisted draft; VERIFIED |
| first_email_sent_at | Date | First successful send timestamp; scope/test contract |
| current_workflow, business_value, recommended_offer | String | Optional stored research; reconstruction |
| confidence_score | Number | Model confidence, not calibrated probability; reconstruction persistence |
| research_status | String | QUALIFIED / NEEDS_MORE_RESEARCH; verified analysis field, persistence unconfirmed |
| public_emails_found | String | JSON list if persisted; verified runtime array, table column unconfirmed |
| telegram_message_id, draft_version | String / Number | Bind approvals to a draft; planned hardening |
| send_attempt_id, send_started_at, smtp_message_id | String / Date / String | Send audit/reconciliation; planned |
| last_error, retry_count, research_completed_at | String / Number / Date | Bounded recovery and observability; planned |
| do_not_contact, replied_at, follow_up_due_at | Boolean / Date / Date | Suppression and follow-up; planned |

Maintain one business row per google_place_id. A get-then-insert check is a sequential deduplication mechanism, not a verified unique database constraint. If two scouts run concurrently, both may see no row and insert. Serialize discovery or add atomic uniqueness in an appropriate persistence layer before scaling.

## 5. Google Places API setup and restrictions

OWNER SCOPE establishes Google Places use; the historical choice between Legacy and New endpoints is unknown. The safe sample uses Places API (New). Do not mix its request body, response field names or billing configuration with Legacy endpoints.

RECONSTRUCTION: create a Google Cloud project, link billing, enable the required Places API, create a dedicated server credential and restrict it to the needed API. For a VPS caller, use the confirmed public outbound IP restriction; browser HTTP-referrer restrictions are unsuitable for this server request. Keep the key in n8n credentials and set quotas/budget alerts in the console.

Sample Text Search request: POST https://places.googleapis.com/v1/places:searchText; JSON body has textQuery such as “example trade in example suburb”. Required headers include Content-Type: application/json, X-Goog-Api-Key supplied by credentials and X-Goog-FieldMask selecting only the needed fields. The sample field mask covers id, displayName, formattedAddress and websiteUri. Add phone/details only when needed and budgeted.

Map places.id to google_place_id, displayName.text to business_name, websiteUri to website and formattedAddress to business_address. Preserve niche/location from the queue rather than trusting the search response to reproduce them. Handle empty results, pagination supported by the chosen API, quota errors and transient failures explicitly. A pagination token must stay associated with its originating query.

Troubleshooting guidance, not recovered historical incidents: a denied request can result from wrong API restrictions, wrong outbound IP, disabled API or billing; a missing field mask causes New API errors; response paths differ between New and Legacy. Check the exact error response before changing restrictions. Keep requests HTTPS and avoid printing authentication headers in logs.

References: https://developers.google.com/maps/documentation/places/web-service/reference/rest/v1/places/searchText and https://developers.google.com/maps/api-security-best-practices

## 6. Workflow 01: Lead Scout and dynamic search queue

OWNER SCOPE: lead discovery uses a dynamic niche/location search queue and duplicate protection. Exact historical queue table and nodes are unverified.

RECONSTRUCTION node contract:

1. Manual Trigger initially; Schedule Trigger later. Retrieve one eligible queue item.
2. Claim that item for this run. Construct query from its niche and location.
3. Google Places Text Search. Follow bounded pagination, respect rate limits and budget.
4. Normalize each place into the lead contract; reject records without a stable place ID.
5. Get Existing Lead by google_place_id. Existing row: skip insert and preserve its approval/send state. Missing row: insert NEW / NOT_REVIEWED.
6. Record discovered, new, duplicate and failed counts. Mark queue item complete or retryable with next_run_at and bounded retry_count.

Suggested queue contract: queue_id, niche, location, query, status (QUEUED/RUNNING/DONE/FAILED), cursor, last_run_at, next_run_at, retry_count and last_error. These names are illustrative. Expanding niches/locations should add rows instead of requiring code edits. The example queue uses entirely fictional locations and is not production prospect data.

Do not reset existing leads to NEW when rediscovered. Discovery deduplication prevents repeated rows; it is separate from the email-send guard in Workflow 03. Queues need a claim/recovery strategy before multiple workers are enabled.

## 7. Workflow 02: website enrichment and research

### 7.1 Verified lead selection fix

Get New Lead: Resource Row; Operation Get; Data table devvibe_leads; Must Match All Conditions; one condition status Equals NEW. Value NEW is Fixed, not Expression. Return All OFF; Limit Per Input Row 1.

The table returned data after the filter was corrected. The website condition was moved out of this lookup into Has Website?: expression {{ $json.website }}, is not empty. TRUE goes to Fetch Website. Missing-website status handling was not verified; recommended terminal state NO_WEBSITE prevents endless reselection. This is a proposed extension, not a confirmed deployed status.

### 7.2 Fetching and cleaning (reconstruction)

Fetch Website performs a bounded HTTP GET and returns text. Keep the original lead identity alongside response content: HTTP nodes can replace item JSON. Set a timeout and response-size limit; accept HTML/text only. Record redirect destination and fetch result. Do not fetch private/local network targets; revalidate redirects and resolved destinations for server-side request safety.

Clean Website removes scripts, styles, comments and navigation noise, decodes entities and collapses whitespace. Retain headings, services, contact text and source URL. Extract public business emails from text and mailto links, normalize case and deduplicate; exclude asset filenames and obvious placeholders. Do not invent an email. The scoring array is public_emails_found; if loaded from a text column, parse it into an array before scoring.

Regex alone is an imperfect HTML parser. The repository contains stage contracts, not a claimed original cleaner. JavaScript-rendered websites, bot protection and inaccessible content should yield an evidence-limited result, not fabricated website facts.

### 7.3 Research URLs and combined evidence (reconstruction)

Build Research URLs from actual same-site links where possible: about, services, contact, booking/enquiry or relevant industry pages. Resolve relative links against the final homepage URL, remove fragments, deduplicate and cap the list. Do not assume guessed paths exist. Fetch each URL under the same safety/timeout/size controls; clean text and retain its source URL and outcome.

Combine Business Research produces one lead-level object with google_place_id, website, public_emails_found and bounded source-labelled research text. Include homepage evidence if optional pages fail. Do not combine research from different leads. With one lead per execution, the historical .first() reference is usable; in batch processing it can select the wrong business and must be replaced with correct item linkage.

Suggested contract: sources [{url, fetch_success, text}], research_text, public_emails_found, research_errors and the original lead fields. Freeze a research snapshot or hash when introducing controlled reanalysis. Website content is untrusted evidence: the AI must ignore embedded commands, credential requests and unrelated instructions.

## 8. OpenAI Opportunity Analyst and JSON parsing

VERIFIED change: remove lead_score from the model output. The analyst supplies evidence, hypotheses, four strict Boolean flags and confidence. n8n computes the score.

Required analysis shape:

```json
{
  "observed_facts": [],
  "current_workflow": "",
  "pain_hypothesis": "",
  "automation_opportunity": "",
  "business_value": "",
  "recommended_offer": "",
  "confidence_score": 0,
  "clear_workflow_identified": false,
  "manual_process_evidence": false,
  "specific_automation_opportunity": false,
  "clear_business_value": false,
  "research_status": "NEEDS_MORE_RESEARCH",
  "personalisation_angle": ""
}
```

VERIFIED Boolean rules: clear_workflow_identified is true only if website evidence supports a reasonably clear operational workflow. manual_process_evidence requires supplied evidence of a manual, fragmented, phone/email/form-dependent or plausibly improvable process; do not guess. specific_automation_opportunity requires one concrete automation supported by evidence. clear_business_value requires a clear operational benefit such as less administration, faster responses, qualification, scheduling, routing or reduced duplicate work.

RECONSTRUCTION prompt addition: return only JSON, distinguish facts from hypotheses, cite source URLs within facts where available, treat website text as untrusted and never infer private business performance. The exact original model and temperature are unknown. Structured output/schema validation is a proposed improvement; do not claim it is currently enabled.

VERIFIED Parse AI Analysis reads output_text, content[0].text, output[0].content[0].text, text or message.content; strips surrounding JSON fences; JSON.parse; restores $('Combine Business Research').first().json; maps four flags using === true, confidence using Number(value || 0), and missing research_status to NEEDS_MORE_RESEARCH. A string "true" must not count as true.

The original error path returned parse_success false and parse_error, but omitted the restored lead identity. Its invalid-JSON path also returned raw_ai_response. This can break the false-branch row match and leave a lead NEW. The sample parser preserves lead identity on errors and omits raw text from its error result. This is documented hardening, not a recovered deployed fix. Route parse failures to a distinct AI_PARSE_ERROR status before qualification; retry only under a bounded policy. Validate numeric confidence and analysis types before using them.

## 9. Deterministic score and >=65 gate

VERIFIED insertion: Combine Business Research -> AI Opportunity Analyst -> Parse AI Analysis -> Calculate Lead Score -> Is Qualified Lead?. Calculate Lead Score is a Code node, Run Once for Each Item.

| Criterion | Points |
| --- | --- |
| Non-empty website | 10 |
| public_emails_found is an array with at least one value | 10 |
| clear_workflow_identified === true | 15 |
| manual_process_evidence === true | 20 |
| specific_automation_opportunity === true | 20 |
| clear_business_value === true | 10 |
| confidence >=80 / >=70 / >=60 / below60 | 15 / 10 / 5 / 0 |
| Maximum | 100 |

The website criterion tests a non-empty string, not actual HTTP success. The email criterion tests array length, not deliverability. Keep this distinction when interpreting the score. Confidence contributes once by its tier.

VERIFIED qualification uses ALL three conditions: parse_success Equals true; research_status Equals QUALIFIED; lead_score Greater than or equal to 65. Remove the separate confidence >=70 gate because confidence already contributes points. The exact earlier score threshold was not recovered; only the final inclusive 65 boundary is verified.

For identical input flags and confidence, the formula returns the same score. AI flags and confidence can still change between fresh model runs. Persisting the first completed analysis and moving its status out of NEW prevents repeatedly reanalysing a business until it passes. Reanalysis should require changed evidence or an intentional policy.

Example synthetic weaker lead: website 10 + email 10 + workflow 15 + automation 20 + confidence 65 tier 5 = 60; not qualified. Strong evidence with all flags and confidence 82 = 100. A score of exactly 65 passes only if parse_success and research_status also pass. Qualification does not itself authorize sending.

VERIFIED FALSE branch: Mark Lead Not Qualified updates the row matched by {{ $json.google_place_id }}. Persist lead_score; observed_signal = {{ JSON.stringify($json.observed_facts) }}; pain_hypothesis; automation_opportunity; status AI_NOT_QUALIFIED. Earlier advice offered NEEDS_MORE_RESEARCH for insufficient evidence; the later concrete configuration uses AI_NOT_QUALIFIED for the false branch. Confirm the actual deployed choice. Parse/network failures deserve distinct retry/error states rather than being silently classified as commercial rejection.

TRUE branch Save AI Analysis moves the lead to AI_QUALIFIED before generating outreach. Do not leave either completed branch NEW. This prevents reselection on the next execution; automatic next-item looping remains planned.

## 10. Outreach generation, parsing and saving

VERIFIED order: AI Outreach Writer -> Parse Outreach Email -> Save Outreach Draft -> Send Approval Request.

RECONSTRUCTION writer contract: use only observed facts and a carefully qualified pain hypothesis; propose one relevant DevVibe automation and one clear call to action. Avoid invented achievements, metrics, relationships or guarantees. Choose a public business email present in research. Return selected_email, email_subject and email_body as JSON. The exact historical writing prompt and parser code were not retrieved.

Parse Outreach Email should extract response text, parse JSON, recover the current lead identity and validate all three fields. selected_email must belong to the researched email set. Empty subject/body, invalid JSON or missing recipient should stop draft progression and enter a recoverable error/no-contact state. Persist the exact draft reviewed on Telegram and send that persisted content; do not regenerate after approval.

VERIFIED Save Outreach Draft configuration: Data table devvibe_leads; Operation Update. Match google_place_id Equals {{ $('Parse Outreach Email').first().json.google_place_id }}. Values:

```text
email           {{ $('Parse Outreach Email').first().json.selected_email }}
email_subject   {{ $('Parse Outreach Email').first().json.email_subject }}
email_body      {{ $('Parse Outreach Email').first().json.email_body }}
status          EMAIL_READY
approval_status PENDING_APPROVAL
```

This .first() form reflects the one-lead execution in the recovered instructions. Before looping or parallelism, replace it with lead-specific item references to avoid attaching one business’s email to another row. Confirm exactly one matching row is updated before sending a review request.

## 11. Telegram approval request and callbacks

OWNER SCOPE confirms Telegram buttons, parsing and Switch routing. The original callback delimiter, exact message template and chat identifiers are not recoverable. The following is an explicit safe sample convention, not a historical export.

Message: business name, niche/location, evidence summary, score, proposed opportunity, recipient, subject and full persisted body. Include Approve, Reject and Do Not Contact buttons, but disable or clearly label unimplemented branches until they perform persistent suppression. Escape content for the chosen Telegram parse mode or use plain text. Keep messages within API limits; do not silently truncate the draft under review.

Sample callback data: APPROVE|lead_demo_001, REJECT|lead_demo_001, DNC|lead_demo_001. For real use, choose a short opaque internal row identifier and map it to google_place_id server-side. Telegram callback_data is limited to 1-64 bytes, so do not assume every Google ID plus action/version fits. A planned version-bound approval adds draft_version or an opaque signed reference within that budget.

Parse callback_query.data from the Telegram Trigger; validate the exact action and identifier; preserve callback_query.id for acknowledgement and message/chat/sender references for authorization. Switch on action with APPROVE, REJECT, DNC and a default invalid route. Answer the callback query to clear the client spinner. A callback must come from an allowed reviewer/chat; anyone who can send a payload must not be able to authorize email merely by knowing a lead ID.

The sample callback parser illustrates shape validation. It does not implement reviewer authorization or cryptographic binding. Review those before production concurrency or broader reviewer access. Telegram reference: https://core.telegram.org/bots/api

## 12. Workflow 03: approval handler and Titan SMTP

RECONSTRUCTION of the intended send path: Telegram Trigger -> Parse Callback -> authorization validation -> Switch Action -> APPROVE -> Get Lead by identifier -> Can Send Email? -> Mark SENDING -> Send Email -> Mark EMAIL_SENT -> notify/update review message. Exact deployed node names outside Can Send Email? were not recovered.

Can Send Email? must evaluate a freshly fetched table row, not stale Telegram message content. Before the claim, require status EMAIL_READY, approval_status PENDING_APPROVAL, no first_email_sent_at, a persisted recipient/subject/body and no suppression. Missing rows, unknown actions and unauthorized callbacks stop without sending. A planned draft-version check blocks approvals on superseded drafts.

Claim step changes status to SENDING and approval_status to APPROVED before SMTP. The SMTP branch is downstream of a successful claim; it does not rerun the pre-claim PENDING_APPROVAL check after changing that field. Verify the claim affected exactly one eligible row. For concurrency safety this needs an atomic compare-and-set or serialized approval processing; an ordinary read followed by unconditional update is insufficient.

OWNER SCOPE confirms Titan SMTP. Standard reference settings are smtp.titan.email, 465 with implicit SSL/TLS or 587 with STARTTLS, using the full mailbox address as username. Obtain the actual account/region-specific host from Titan/Hostinger; some accounts use numbered hosts. Do not disable certificate verification. Configure n8n SMTP credentials privately and bind sender identity to the authenticated mailbox or permitted sender.

Send Email uses email, email_subject and email_body from the claimed persisted draft. During acceptance testing use an owner-controlled inbox with synthetic draft content. The user’s successful report does not reveal whether the tested recipient was the owner inbox or a prospect; this guide does not include it.

After SMTP success, update the same lead to EMAIL_SENT / APPROVED and set first_email_sent_at to the first successful timestamp, commonly {{ $now.toISO() }} when no earlier value exists. Preserve an existing first timestamp. Planned audit fields record attempt ID and SMTP message ID. SMTP acceptance means the server accepted submission, not guaranteed inbox placement.

If SMTP fails or times out, do not automatically reset to EMAIL_READY: acceptance may have occurred before the response was lost. Keep SENDING with an error/reconciliation flag, inspect delivery evidence and make a deliberate recovery decision. If SMTP succeeded but the final table update failed, the same ambiguity exists. This is a remaining operational risk; the verified second-click test is not an exactly-once guarantee across failures.

References: https://support.hostinger.com/en/articles/5966022-how-to-get-email-account-configuration-details-for-titan-email and https://support.titan.email/hc/en-us/articles/900000215446-Configure-Titan-on-other-apps-using-IMAP-POP

## 13. Send-state contract and duplicate protection

| Event | status | approval_status | first_email_sent_at |
| --- | --- | --- | --- |
| Scout inserts lead | NEW | NOT_REVIEWED | Empty |
| Qualified analysis saved | AI_QUALIFIED | NOT_REVIEWED | Empty |
| Draft persisted before Telegram | EMAIL_READY | PENDING_APPROVAL | Empty |
| Valid approval claimed | SENDING | APPROVED | Empty until successful submission |
| SMTP success recorded | EMAIL_SENT | APPROVED | First successful-send timestamp |
| Second approval | Remains EMAIL_SENT | Remains APPROVED | Preserved |
| Failed qualification | AI_NOT_QUALIFIED | NOT_REVIEWED | Empty |

EMAIL_READY with NOT_REVIEWED is an inconsistent draft-review state. APPROVED with SENDING is valid while the send is in progress. EMAIL_SENT with APPROVED is valid and must block another first email. State values are case-sensitive in the configured filters; the conversation’s informal “Email_Sent” spelling describes the canonical EMAIL_SENT state.

Three distinct protections: discovery checks google_place_id before insertion; enrichment retrieves NEW only and persists a terminal analysis state; first-email send requires the precise ready/pending state and empty send timestamp. Future follow-ups must have their own eligibility and attempt controls; they must not reset the first-email guard.

## 14. Recovered issues and exact fixes

| Issue | Recovered fix | Evidence / limitation |
| --- | --- | --- |
| Get New Lead did not return fresh data | Rebuild status Equals NEW as Fixed, All Conditions, Return All OFF, Limit 1; move website check to IF | VERIFIED; exact faulty former filter unavailable |
| EMAIL_READY / NOT_REVIEWED blocked approval | Save Outreach Draft writes approval_status PENDING_APPROVAL and saves before Telegram | VERIFIED; guard correctly blocked inconsistent state |
| Existing draft stuck at NOT_REVIEWED | For testing only, change that reviewed draft to PENDING_APPROVAL and approve again | VERIFIED recommendation; do not reset sent rows |
| Same weak lead eventually crossed threshold on reruns | Remove model lead_score; add deterministic Code score; persist analysis status out of NEW | VERIFIED instruction and user success report |
| False branch stopped with lead still NEW | Mark Lead Not Qualified updates by google_place_id to AI_NOT_QUALIFIED | VERIFIED concrete configuration |
| Separate confidence gate double-filtered leads | Remove confidence >=70 gate; use parse_success, QUALIFIED and score >=65 | VERIFIED |
| Second Approve click | Can Send Email? evaluates sent/approved row as false, no second email | VERIFIED user-reported test |
| Parse error can lose lead ID | Sample parser preserves identity and separate error status | NEW hardening finding, not historical fix |
| .first() unsafe for multiple leads | Replace with correct linked/current-item identity before batching | PLANNED hardening |
| Simultaneous callbacks or ambiguous SMTP outcome | Atomic claim/serialization and reconciliation | PLANNED; not covered by sequential test |

No other exact historical incident should be inferred from this table. API, SMTP, HTML-cleaning and VPS troubleshooting in this guide are reconstruction guidance until supported by earlier evidence.

## 15. Acceptance checks and operator runbook

The completed documentation samples are offline illustrations. They do not send email or access APIs. Validate the actual n8n instance separately, with synthetic business rows and an owner-controlled test inbox.

1. Scout the same synthetic place twice: one row, state preserved. Test concurrent scouting before enabling parallel execution.
2. Get New Lead returns one NEW record. Missing website exits NEW through a defined branch.
3. Research survives an optional-page failure, keeps source URLs and never mixes two leads. No public email means no sendable draft.
4. Malformed AI output preserves google_place_id and routes to an error state. Boolean strings do not earn points.
5. Same scoring input yields same output. Verify confidence 59/60/69/70/79/80; maximum 100; 64 fails, 65 qualifies only with the other two conditions.
6. False qualification saves score/evidence and leaves NEW. A second enrichment run selects another lead.
7. Draft save yields EMAIL_READY / PENDING_APPROVAL before Telegram appears. Persisted draft matches what the reviewer saw.
8. First valid approval sends once and saves EMAIL_SENT / APPROVED with a non-empty first_email_sent_at. A second approval is false and preserves the timestamp. This sequence was user-reported as successful for sending/duplicate blocking; timestamp inspection remains unverified.
9. Invalid action, wrong reviewer/chat, missing row, blank fields, DNC and stale draft version all block sending. Planned controls must be implemented before counting these checks as passed.
10. Concurrent clicks, SMTP timeout and failed final update enter controlled reconciliation without automatic resend.

Daily runbook (planned): inspect failed executions and SENDING rows; reconcile uncertain sends; review queue backlog, research errors and pending approvals; monitor API usage and mail limits. Investigate by execution/attempt ID using redacted metadata. Do not copy bodies, prospect addresses or credentials into public issues. Never repair a duplicate-send block by resetting EMAIL_SENT to EMAIL_READY.

## 16. Remaining work in implementation order

1. **Reject and DNC branches:** persist REJECTED approval and an appropriate terminal operational state. DNC sets durable suppression checked by scouts, drafts, approval and follow-ups. Acknowledge callbacks and remove/disable action buttons. Distinguish a rejected draft from permanent do-not-contact.
2. **Identity and error hardening:** preserve lead context through HTTP/AI nodes, add parse/no-website/no-email outcomes, eliminate .first() assumptions for loops and bind callbacks to reviewed draft versions and authorized reviewers.
3. **Claims and send recovery:** serialize or atomically claim eligible leads; add attempts and error audit; reconcile ambiguous SMTP outcomes; add bounded retries only where safe.
4. **Titan IMAP reply monitor:** use actual mailbox settings (standard IMAP 993 SSL/TLS), deduplicate inbound Message-ID, correlate In-Reply-To/References with saved outgoing identifiers, record replies and suppress follow-ups. Treat bounces and out-of-office separately. Do not rely on subject matching alone or blindly convert a sender into a lead.
5. **Two-business-day follow-up:** calculate in an explicitly chosen timezone/calendar from the first successful send. Skip weekends and define public-holiday policy. At the same local time, Friday +2 business days is Tuesday if no holiday. Add calendar days in timezone-aware code, not 48 hours or a fixed UTC offset; Sydney DST can change. Recheck no reply, no bounce/DNC/rejection and no prior follow-up immediately before claiming/sending. Decide whether follow-ups also require human approval.
6. **Continuous processing:** change Get New Lead to Get New Leads with bounded limit (the recovered proposal used 10), then Loop Over Items with batch size 1. Both terminal success and false/error paths return to the loop. Enrichment continues after submitting approval; it should not wait for Telegram approval. Add empty-queue handling, time/budget caps and prevent overlapping runs.
7. **Scheduling:** separately schedule scout, enrichment, IMAP and follow-up sweeps. Keep discovery queue statuses and lead statuses distinct. Enable only after manual-path tests and configured operational limits.
8. **Observability and recovery:** error workflow, alerts on actionable failures, counters by stage, queue lag, pending approvals, stale SENDING age, duplicate blocks, API cost, retries and mail outcomes. Apply execution retention/redaction and restore-test backups. Monitor production webhook availability.

These are a roadmap. None should be marked deployed based on this document alone.

## 17. Repository safety, files and publication gate

Repository package includes this Markdown, its PDF edition, SECURITY.md, .gitignore, fictional queue and API/config examples, evidence-based scoring snippets and descriptive workflow blueprints. Blueprints are expressly not importable n8n exports. This avoids fabricating node versions, credential IDs, table IDs or deployed topology.

All samples use example.com or synthetic identifiers. No Google keys, SMTP passwords, SSH keys, Telegram tokens, private connection records, live leads or full raw conversation are included. Credential values belong in n8n’s encrypted credentials or a private secret store. Environment examples list public configuration and credential names only; they do not imply an environment-variable permission model for Code nodes.

GitHub publication requires the owner’s valid authentication and authorization. The first restricted authentication check reported an invalid login; a later check with permitted network access confirmed a valid login. The owner explicitly authorized creation, commits and pushes for this project. The private repository is https://github.com/sumair95/devvibe-lead-agent. This documentation package is the reviewed publication content; no live workflow exports or prospect records are included. Never paste login tokens into this conversation or the repository.

Before publication, inspect the explicit file allowlist and staged diff, run a secret scan and verify PDF text as well as sample files. .gitignore helps prevent accidents but is not a secret scanner. If an export is later added, remove credential references, live IDs, webhook paths, pinned data and execution/prospect content; export secrets must never enter Git history.

## 18. Provenance and reconciliation checklist

Primary evidence: owner’s requested scope and five recovered recent exchanges from Find Local Leads. They establish (in chronological order) lead filter correction, false-branch/scoring redesign, pending-approval fix, exact score/parser configuration and the final successful send/duplicate test. The PDF and Markdown share the same content.

To finish a complete historical record, obtain the earlier transcript and sanitized Workflow 01/02/03 exports; compare the actual Data Table schema, queue schema, Places API variant, VPS install/domain/proxy/database, AI prompt/model, HTML cleaners, Telegram callbacks, SMTP credential configuration and send guard conditions. Record prior threshold and node revisions only when evidence exists. Verify first_email_sent_at in the live table and inspect every incomplete branch. Do not include raw exports or prospect rows in this public-ready package.

Official references, checked 9 October 2026:

- n8n Data Tables: https://docs.n8n.io/build/work-with-data/data-tables.md
- n8n Docker Compose: https://docs.n8n.io/deploy/host-n8n/install-options/install-using-docker-compose.md
- Places Text Search (New): https://developers.google.com/maps/documentation/places/web-service/reference/rest/v1/places/searchText
- Google key restrictions: https://developers.google.com/maps/api-security-best-practices
- Telegram Bot API: https://core.telegram.org/bots/api
- Titan connection settings: https://support.titan.email/hc/en-us/articles/900000215446-Configure-Titan-on-other-apps-using-IMAP-POP
- Hostinger Titan settings: https://support.hostinger.com/en/articles/5966022-how-to-get-email-account-configuration-details-for-titan-email

Vendor documentation validates reconstruction guidance, not what was historically installed. No claim of live-instance inspection, production activation or full historical recovery is made.
