export const CLIENT_FIELD_LABELS: Record<string, string> = {
  name: 'Nombre',
  contactName: 'Contacto',
  email: 'Correo',
  phone: 'Teléfono',
  company: 'Empresa',
  notes: 'Notas',
};

export const CLIENT_EDITABLE_FIELDS = [
  'name',
  'contactName',
  'email',
  'phone',
  'company',
  'notes',
] as const;

export type ClientEditableField = (typeof CLIENT_EDITABLE_FIELDS)[number];

export function formatClientFieldValue(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  return String(value);
}
