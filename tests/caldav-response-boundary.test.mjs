import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseCalDavMultiStatusResponse } from "../src/infrastructure/caldav/parse-multistatus-response.mjs";
import { readLimitedText } from "../src/infrastructure/http/read-limited-text.mjs";

const xmlResponse = () => new Response(null, { headers: { "content-type": "application/xml" } });
const calendar = `BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nDTSTART:20990101T100000Z\r\nDTEND:20990101T110000Z\r\nEND:VEVENT\r\nEND:VCALENDAR`;

describe("CalDAV response boundary", () => {
  it("cancels streaming responses before they exceed the byte limit", async () => {
    let cancelled = false;
    const response = new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(4));
          controller.enqueue(new Uint8Array(4));
        },
        cancel() {
          cancelled = true;
        }
      })
    );

    await assert.rejects(readLimitedText(response, 5), /exceeds the configured limit/u);
    assert.equal(cancelled, true);
  });

  it("parses only structurally valid WebDAV multistatus XML", () => {
    const valid = '<?xml version="1.0"?><d:multistatus xmlns:d="DAV:"></d:multistatus>';
    assert.deepEqual(parseCalDavMultiStatusResponse(xmlResponse(), valid), { calendarData: [] });
    for (const body of [
      "<html>login</html>",
      "<d:multistatus>",
      '<d:multistatus xmlns:d="DAV:"><d:error /></d:multistatus>',
      '<d:multistatus xmlns:d="DAV:">partial failure</d:multistatus>'
    ]) {
      assert.equal(parseCalDavMultiStatusResponse(xmlResponse(), body), null);
    }
    assert.equal(parseCalDavMultiStatusResponse(new Response(null), valid), null);
  });

  it("rejects inner DAV errors and accepts successful calendar-data", () => {
    const innerError = `
      <d:multistatus xmlns:d="DAV:">
        <d:response><d:status>HTTP/1.1 500 Internal Server Error</d:status></d:response>
      </d:multistatus>`;
    const success = `
      <d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
        <d:response><d:propstat><d:prop><c:calendar-data><![CDATA[${calendar}]]></c:calendar-data></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>
      </d:multistatus>`;

    assert.equal(parseCalDavMultiStatusResponse(xmlResponse(), innerError), null);
    for (const status of ["500 Error", "200 OK HTTP/1.1 500 Error", "200 OK 500 Error", "200 <d:error />"]) {
      assert.equal(parseCalDavMultiStatusResponse(xmlResponse(), success.replace("200 OK", status)), null);
    }
    assert.equal(parseCalDavMultiStatusResponse(xmlResponse(), success).calendarData.length, 1);
  });
});
