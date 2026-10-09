// RECONSTRUCTION sample; no reviewer authorization is implemented here.
// Run Once for Each Item. Authorize sender/chat separately before any action.
const query = $json.callback_query;
const match = typeof query?.data === 'string' ? /^(APPROVE|REJECT|DNC)\|([A-Za-z0-9_-]{1,40})$/.exec(query.data) : null;
if (!match) return { json: { callback_valid: false, callback_query_id: query?.id ?? null } };
return { json: {
  callback_valid: true, action: match[1], lead_ref: match[2],
  callback_query_id: query.id, reviewer_id: query.from?.id,
  chat_id: query.message?.chat?.id, message_id: query.message?.message_id
} };
