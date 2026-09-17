export const CAMPAIGN_STATUS_VALUES = Object.freeze([
  "New",
  "Active",
  "Eligible",
  "Ready",
  "Waitlist",
  "Skipped",
  "Blocked",
  "Sent 1",
  "Follow-Up 1",
  "Follow-Up 2",
  "Completed",
  "Replied",
  "Rejected",
  "Unsubscribed",
  "Stopped",
  "Placement Confirmed",
  "Needs Attention",
  "Paused",
  "Interested",
  "Warm",
  "Future Releases",
  "Failed"
]);

export const TERMINAL_CAMPAIGN_STATUS_VALUES = Object.freeze([
  "Completed",
  "Replied",
  "Rejected",
  "Unsubscribed",
  "Stopped",
  "Placement Confirmed",
  "Needs Attention",
  "Interested",
  "Warm",
  "Future Releases",
  "Failed"
]);

const campaignStatuses = new Set(CAMPAIGN_STATUS_VALUES);
const terminalCampaignStatuses = new Set(TERMINAL_CAMPAIGN_STATUS_VALUES);

export function isCampaignStatus(value) {
  return campaignStatuses.has(value);
}

export function isTerminalCampaignStatus(value) {
  return terminalCampaignStatuses.has(value);
}
