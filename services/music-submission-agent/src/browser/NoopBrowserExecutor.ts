import type { BrowserActionResult, BrowserExecutor } from './BrowserExecutor.js';

export class NoopBrowserExecutor implements BrowserExecutor {
  private readonly logLines: string[] = [];

  public async navigate(url: string): Promise<BrowserActionResult> {
    this.logLines.push(`noop:navigate:${url}`);
    return {
      ok: false,
      needsManualReview: true,
      reason: 'Noop browser executor cannot perform submissions'
    };
  }

  public async fillForm(fields: Record<string, string>): Promise<BrowserActionResult> {
    this.logLines.push(`noop:fillForm:${Object.keys(fields).join(',')}`);
    return {
      ok: false,
      needsManualReview: true,
      reason: 'Noop browser executor cannot fill forms'
    };
  }

  public async uploadFile(fieldName: string, fileUrl: string): Promise<BrowserActionResult> {
    this.logLines.push(`noop:uploadFile:${fieldName}:${fileUrl}`);
    return {
      ok: false,
      needsManualReview: true,
      reason: 'Noop browser executor cannot upload files'
    };
  }

  public async screenshot(label: string): Promise<BrowserActionResult> {
    this.logLines.push(`noop:screenshot:${label}`);
    return {
      ok: true,
      needsManualReview: false,
      data: { label, stored: false }
    };
  }

  public async inspectDom(selectors: string[] = []): Promise<BrowserActionResult> {
    this.logLines.push(`noop:inspectDom:${selectors.join(',')}`);
    return {
      ok: true,
      needsManualReview: false,
      data: { selectors, nodes: [] }
    };
  }

  public async logs(): Promise<string[]> {
    return [...this.logLines];
  }
}
