import { DOMParser } from "@xmldom/xmldom";

const DAV_NAMESPACE = "DAV:";
const CALDAV_NAMESPACE = "urn:ietf:params:xml:ns:caldav";
export const MAX_CALDAV_XML_BYTES = 5 * 1024 * 1024;

export function parseCalDavMultiStatusResponse(response, body) {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (
    typeof body !== "string" ||
    !contentType.includes("xml") ||
    Buffer.byteLength(body) > MAX_CALDAV_XML_BYTES ||
    /<!DOCTYPE/iu.test(body)
  ) {
    return null;
  }

  let document;
  try {
    document = new DOMParser({
      onError() {
        throw new Error("Invalid XML");
      }
    }).parseFromString(body, "application/xml");
  } catch {
    return null;
  }

  const root = document.documentElement;
  if (!isElement(root, DAV_NAMESPACE, "multistatus") || !hasOnlyElements(root, DAV_NAMESPACE, ["response"])) {
    return null;
  }

  const calendarData = [];
  for (const responseNode of childElements(root, DAV_NAMESPACE, "response")) {
    if (!hasOnlyElements(responseNode, DAV_NAMESPACE, ["href", "status", "propstat"])) return null;
    const responseDataStart = calendarData.length;
    const directStatuses = parseStatusCodes(childElements(responseNode, DAV_NAMESPACE, "status"), false);
    const propstats = childElements(responseNode, DAV_NAMESPACE, "propstat");
    if (
      directStatuses === null ||
      directStatuses.length > 1 ||
      directStatuses.some((status) => status < 200 || status >= 300) ||
      (directStatuses.length > 0 && propstats.length > 0) ||
      (!directStatuses.length && !propstats.length)
    ) {
      return null;
    }

    for (const propstat of propstats) {
      if (!hasOnlyElements(propstat, DAV_NAMESPACE, ["prop", "status"])) return null;
      const props = childElements(propstat, DAV_NAMESPACE, "prop");
      if (props.length !== 1) {
        return null;
      }
      const prop = props[0];
      const dataNodes = childElements(prop, CALDAV_NAMESPACE, "calendar-data");
      const propstatStatuses = parseStatusCodes(childElements(propstat, DAV_NAMESPACE, "status"), true);
      if (propstatStatuses === null || propstatStatuses.length !== 1) {
        return null;
      }
      if (!dataNodes.length) {
        continue;
      }
      if (propstatStatuses.some((status) => status < 200 || status >= 300)) {
        return null;
      }

      for (const node of dataNodes) {
        const value = node.textContent.trim();
        if (!value) {
          return null;
        }
        calendarData.push(value);
      }
    }

    if (calendarData.length === responseDataStart) {
      return null;
    }
  }

  if (calendarData.length !== root.getElementsByTagNameNS(CALDAV_NAMESPACE, "calendar-data").length) {
    return null;
  }

  return Object.freeze({ calendarData: Object.freeze(calendarData) });
}

function childElements(parent, namespace, localName) {
  return Array.from(parent.childNodes).filter((node) => isElement(node, namespace, localName));
}

function isElement(node, namespace, localName) {
  return node?.nodeType === 1 && node.namespaceURI === namespace && node.localName === localName;
}

function hasOnlyElements(parent, namespace, allowedNames) {
  return Array.from(parent.childNodes).every((node) => {
    if (node.nodeType === 3 || node.nodeType === 4) return !node.textContent.trim();
    if (node.nodeType === 8) return true;
    return node.nodeType === 1 && node.namespaceURI === namespace && allowedNames.includes(node.localName);
  });
}

function parseStatusCodes(statusNodes, required) {
  if (required && statusNodes.length === 0) {
    return null;
  }

  const statuses = statusNodes.map((node) => {
    if (!Array.from(node.childNodes).every((child) => child.nodeType === 3 || child.nodeType === 4)) {
      return Number.NaN;
    }
    const match = node.textContent
      .trim()
      .match(/^HTTP\/\d(?:\.\d)? ([1-5]\d{2})(?: [A-Za-z][A-Za-z .'-]*)?$/u);
    return match ? Number(match[1]) : Number.NaN;
  });
  return statuses.every(Number.isFinite) ? statuses : null;
}
