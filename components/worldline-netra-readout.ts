import { formatNetraCoord } from "@/lib/globe-coordinates";

export type NetraTargetIdentity =
  | { kind: "place"; nodeName?: string; city: string; country: string }
  | { kind: "field" | "orbital"; name: string; detail?: string };

/** Place.name already follows the authored "City · COUNTRY_CODE" contract. */
export function createNetraPlaceIdentity(
  placeName: string,
  nodeName?: string,
): NetraTargetIdentity {
  const [city = "", ...country] = placeName.split("·").map((part) => part.trim());
  const internal = nodeName?.trim();
  const sameName = (value: string) => value.replace(/\s+/g, " ").toLowerCase();
  return {
    kind: "place",
    nodeName: internal && sameName(internal) !== sameName(city) ? internal : undefined,
    city,
    country: country.join(" · "),
  };
}

/** Separate semantic rows let the instrument reserve space without fake text. */
export function formatNetraTargetIdentity(target: NetraTargetIdentity): {
  nodeName: string;
  name: string;
  primary: string;
  secondary: string;
  full: string;
} {
  const nodeName = target.kind === "place" ? target.nodeName ?? "" : "";
  const name = target.kind === "place" ? target.city.toUpperCase() : target.name;
  const secondary = target.kind === "place" ? target.country.toUpperCase() : target.detail ?? "";
  const heading = [nodeName, name].filter(Boolean).join(" · ");
  return {
    nodeName,
    name,
    primary: heading + (secondary ? " ·" : ""),
    secondary,
    full: [heading, secondary].filter(Boolean).join(" · "),
  };
}

export function formatNetraCoordinateRows(
  coords: { lat: number; lon: number } | null,
  orbital = false,
): { latitude: string; longitude: string } {
  if (!coords) return { latitude: orbital ? "—" : "", longitude: "" };
  // Keep the existing hemisphere/precision formatter; no geometry changes.
  const [latitude, longitude] = formatNetraCoord(coords.lat, coords.lon).split(" · ");
  return { latitude: `${latitude} ·`, longitude };
}

/** An orbital identity has no GPS, even if a panel reset left a camera lock. */
export function resolveNetraCoordinateRows(
  target: NetraTargetIdentity,
  lock: { lat: number; lon: number } | null,
  hover: { lat: number; lon: number } | null,
  orbitalActive: boolean,
): { latitude: string; longitude: string } {
  if (target.kind === "orbital") return formatNetraCoordinateRows(null, true);
  const coords = lock ?? (orbitalActive ? null : hover);
  return formatNetraCoordinateRows(coords, orbitalActive);
}
