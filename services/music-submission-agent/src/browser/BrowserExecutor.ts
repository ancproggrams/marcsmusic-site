export interface BrowserActionResult {
  ok: boolean;
  needsManualReview: boolean;
  reason?: string;
  data?: Record<string, unknown>;
}

export interface BrowserExecutor {
  navigate(url: string): Promise<BrowserActionResult>;
  fillForm(fields: Record<string, string>): Promise<BrowserActionResult>;
  uploadFile(fieldName: string, fileUrl: string): Promise<BrowserActionResult>;
  screenshot(label: string): Promise<BrowserActionResult>;
  inspectDom(selectors?: string[]): Promise<BrowserActionResult>;
  logs(): Promise<string[]>;
}

export const protectedWorkflowReasons = {
  captcha: 'CAPTCHA or anti-bot workflow detected',
  login: 'login required',
  payment: 'payment required',
  manualApproval: 'manual approval required'
} as const;
