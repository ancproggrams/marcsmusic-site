export interface FetchResult {
  url: string;
  status: number;
  ok: boolean;
  contentType: string;
  text: string;
}

export class HttpClient {
  public constructor(private readonly timeoutMs = 12_000) {}

  public async fetchText(url: string): Promise<FetchResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          'user-agent': 'MarcsMusicSubmissionAgent/0.1 (+https://marcsmusic.nl; public verification only)'
        }
      });
      const contentType = response.headers.get('content-type') ?? '';
      const text =
        contentType.includes('text') || contentType.includes('html') || contentType.includes('json')
          ? await response.text()
          : '';

      return {
        url: response.url,
        status: response.status,
        ok: response.ok,
        contentType,
        text: text.slice(0, 750_000)
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`timeout fetching ${url}`);
      }

      throw new Error(`network error fetching ${url}: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      clearTimeout(timeout);
    }
  }
}
