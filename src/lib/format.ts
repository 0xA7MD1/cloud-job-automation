// عربي بأرقام لاتينية وتقويم ميلادي
const dateFormatter = new Intl.DateTimeFormat("ar-u-ca-gregory-nu-latn", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function formatDateTime(value: string | Date): string {
  return dateFormatter.format(typeof value === "string" ? new Date(value) : value);
}
