const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function normalizeText(value: FormDataEntryValue | null) {
  return String(value ?? '').trim();
}

export function parseUuid(
  value: FormDataEntryValue | null,
  fieldName: string
): string {
  const text = normalizeText(value);
  if (!UUID_RE.test(text)) {
    throw new Error(`${fieldName} is invalid.`);
  }
  return text;
}

export function parseOptionalUuid(
  value: FormDataEntryValue | null,
  fieldName: string
) {
  const text = normalizeText(value);
  if (!text) {
    return null;
  }
  if (!UUID_RE.test(text)) {
    throw new Error(`${fieldName} is invalid.`);
  }
  return text;
}

export function parsePositiveQuantity(
  value: FormDataEntryValue | null,
  fieldName: string
) {
  const text = normalizeText(value);
  const quantity = Number(text);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error(`${fieldName} must be greater than 0.`);
  }
  return Math.round(quantity * 100) / 100;
}

export function parseBizDate(value: FormDataEntryValue | null) {
  const text = normalizeText(value);
  if (!text) {
    return new Date().toISOString().slice(0, 10);
  }

  if (!DATE_RE.test(text)) {
    throw new Error('bizDate format is invalid.');
  }

  const date = new Date(`${text}T00:00:00Z`);
  if (!Number.isFinite(date.getTime())) {
    throw new Error('bizDate format is invalid.');
  }

  return text;
}

export function parseRemark(value: FormDataEntryValue | null) {
  const text = normalizeText(value);
  if (!text) {
    return null;
  }
  return text.slice(0, 500);
}

export function toOperatorUserId(value: string) {
  if (!/^\d+$/.test(value)) {
    return null;
  }

  const n = Number(value);
  if (!Number.isSafeInteger(n) || n <= 0) {
    return null;
  }

  return n;
}

