/** locale date-time formatting; tz optional (IANA) */
export function formatDateTime(iso: string, tz?: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: tz,
  }).format(d);
}
