import type { BrowserActionResult, BrowserExecutor } from './BrowserExecutor.js';

export class VercelAgentBrowserExecutor implements BrowserExecutor {
  public async navigate(): Promise<BrowserActionResult> {
    return this.notConfigured();
  }

  public async fillForm(): Promise<BrowserActionResult> {
    return this.notConfigured();
  }

  public async uploadFile(): Promise<BrowserActionResult> {
    return this.notConfigured();
  }

  public async screenshot(): Promise<BrowserActionResult> {
    return this.notConfigured();
  }

  public async inspectDom(): Promise<BrowserActionResult> {
    return this.notConfigured();
  }

  public async logs(): Promise<string[]> {
    return ['vercel-agent-browser:not-configured'];
  }

  private notConfigured(): BrowserActionResult {
    return {
      ok: false,
      needsManualReview: true,
      reason: 'Vercel Agent Browser executor is not configured in this MVP'
    };
  }
}
