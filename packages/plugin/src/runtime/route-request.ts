const reservedRoots = new Set(["__manifester", "api"]);
const controlCharacter = /[\u0000-\u001f\u007f]/u;

function encodeSegment(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
}

export function requestedRoutePath(value: string): string | null {
  const raw = value.split(/[?#]/u, 1)[0];
  if (!raw?.startsWith("/") || raw.length > 1_000) return null;
  if (raw === "/") return raw;
  const parts = raw.split("/");
  if (parts.at(-1) === "") parts.pop();
  const encoded = parts.slice(1);
  if (!encoded.length || encoded.length > 12 || encoded.some((part) => !part)) return null;
  try {
    const segments = encoded.map((part) => decodeURIComponent(part).normalize("NFC"));
    if (reservedRoots.has(segments[0]?.toLowerCase() ?? "")
      || segments.some((part) => part.length > 120
        || part === "."
        || part === ".."
        || part.includes("/")
        || part.includes("\\")
        || controlCharacter.test(part))) return null;
    return `/${segments.map(encodeSegment).join("/")}`;
  } catch {
    return null;
  }
}
