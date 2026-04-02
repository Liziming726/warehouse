const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function normalizeText(value: FormDataEntryValue | null) {
  return String(value ?? '').trim();
}

function toFieldLabel(fieldName: string) {
  if (fieldName === 'productId') {
    return '产品';
  }
  if (fieldName === 'warehouseId') {
    return '仓库';
  }
  if (fieldName === 'quantity') {
    return '数量';
  }
  return fieldName;
}

export function parseUuid(
  value: FormDataEntryValue | null,
  fieldName: string
): string {
  const text = normalizeText(value);
  if (!UUID_RE.test(text)) {
    throw new Error(`${toFieldLabel(fieldName)}格式不正确。`);
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
    throw new Error(`${toFieldLabel(fieldName)}格式不正确。`);
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
    throw new Error(`${toFieldLabel(fieldName)}必须大于 0。`);
  }
  return Math.round(quantity * 100) / 100;
}

export function parseBizDate(value: FormDataEntryValue | null) {
  const text = normalizeText(value);
  if (!text) {
    return new Date().toISOString().slice(0, 10);
  }

  if (!DATE_RE.test(text)) {
    throw new Error('业务日期格式不正确。');
  }

  const date = new Date(`${text}T00:00:00Z`);
  if (!Number.isFinite(date.getTime())) {
    throw new Error('业务日期格式不正确。');
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
