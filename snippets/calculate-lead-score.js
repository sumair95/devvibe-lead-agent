// VERIFIED formula. n8n Code node: Run Once for Each Item.
let score = 0;
if ($json.website && String($json.website).trim() !== '') score += 10;
if (Array.isArray($json.public_emails_found) && $json.public_emails_found.length > 0) score += 10;
if ($json.clear_workflow_identified === true) score += 15;
if ($json.manual_process_evidence === true) score += 20;
if ($json.specific_automation_opportunity === true) score += 20;
if ($json.clear_business_value === true) score += 10;
const confidence = Number($json.confidence_score || 0);
if (confidence >= 80) score += 15;
else if (confidence >= 70) score += 10;
else if (confidence >= 60) score += 5;
return { json: { ...$json, lead_score: score } };
