// RECONSTRUCTION pre-claim predicate; not an atomic lock or recipient validator.
// Run Once for Each Item; input must be a freshly fetched table row.
const row = $json;
const nonempty = v => typeof v === 'string' && v.trim().length > 0;
const can_send_email = row.status === 'EMAIL_READY' &&
  row.approval_status === 'PENDING_APPROVAL' && !row.first_email_sent_at &&
  row.do_not_contact !== true &&
  nonempty(row.email) && nonempty(row.email_subject) && nonempty(row.email_body);
return { json: { ...row, can_send_email } };
// Require reviewer authorization and successful atomic/serialized claim separately.
