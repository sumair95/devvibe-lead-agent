// Hardened sample based on recovered parser; not a live export.
// Run Once for Each Item; one lead per execution only.
// Replace .first() with correct item linkage before processing multiple leads.
const lead = $('Combine Business Research').first().json;
const input = $json;
const raw = String(
  input.output_text ?? input.content?.[0]?.text ??
  input.output?.[0]?.content?.[0]?.text ?? input.text ?? input.message?.content ?? ''
).trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim();
function fail(reason) {
  return { json: { ...lead, parse_success: false, parse_error: reason } };
}
if (!raw) return fail('OpenAI response text could not be found');
let analysis;
try { analysis = JSON.parse(raw); }
catch { return fail('Invalid JSON'); }
if (!analysis || typeof analysis !== 'object' || Array.isArray(analysis)) return fail('Expected an object');
const strings = ['current_workflow', 'pain_hypothesis', 'automation_opportunity', 'business_value', 'recommended_offer', 'personalisation_angle'];
for (const name of strings) {
  if (typeof analysis[name] !== 'string') return fail(`Invalid ${name}`);
}
const flags = ['clear_workflow_identified', 'manual_process_evidence', 'specific_automation_opportunity', 'clear_business_value'];
for (const name of flags) {
  if (typeof analysis[name] !== 'boolean') return fail(`Invalid ${name}`);
}
if (!Array.isArray(analysis.observed_facts) || !analysis.observed_facts.every(v => typeof v === 'string')) return fail('Invalid observed_facts');
if (typeof analysis.confidence_score !== 'number' || !Number.isFinite(analysis.confidence_score) || analysis.confidence_score < 0 || analysis.confidence_score > 100) return fail('Invalid confidence_score');
if (!['QUALIFIED', 'NEEDS_MORE_RESEARCH'].includes(analysis.research_status)) return fail('Invalid research_status');
const result = { ...lead, observed_facts: analysis.observed_facts, confidence_score: analysis.confidence_score, research_status: analysis.research_status, parse_success: true };
for (const name of [...strings, ...flags]) result[name] = analysis[name];
return { json: result };
