export function normalizePhoneDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

export function telHref(value) {
  const raw = String(value || "").replace(/[^\d+]/g, "");
  return raw ? `tel:${raw}` : null;
}

/** Deep link mở chat Zalo theo SĐT (ưu tiên mở app trên mobile). */
export function zaloHref(value) {
  let digits = normalizePhoneDigits(value);
  if (!digits) return null;
  if (digits.startsWith("84")) {
    // already international
  } else if (digits.startsWith("0")) {
    digits = `84${digits.slice(1)}`;
  } else {
    digits = `84${digits}`;
  }
  return `https://zalo.me/${digits}`;
}
