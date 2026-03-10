import type { ApplicationRow } from '@/components/admin/applicant-card';

function cmToFeetInches(cm: number): string {
  const totalInches = cm / 2.54;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  return `${feet}'${inches}"`;
}

function escapeCsv(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

export function buildShortlistCsv(applications: ApplicationRow[]): string {
  const headers = ['Rank', 'Name', 'Gender', 'Height', 'Weight (kg)', 'Location', 'Talent Type', 'Experience', 'Admin Notes'];
  const rows = [headers.join(',')];

  const sorted = [...applications].sort(
    (a, b) => (a.shortlist_rank ?? 999) - (b.shortlist_rank ?? 999),
  );

  for (const app of sorted) {
    const p = app.profiles;
    const name = p?.display_name || `${p?.first_name ?? ''} ${p?.last_name ?? ''}`.trim() || 'Unknown';
    const height = p?.height_cm ? cmToFeetInches(p.height_cm) : '';
    const location = [p?.city, p?.state].filter(Boolean).join(', ');
    const talentTypes = (p?.talent_type ?? []).join('; ');

    const row = [
      String(app.shortlist_rank ?? ''),
      escapeCsv(name),
      p?.gender ?? '',
      height,
      p?.weight_kg != null ? String(p.weight_kg) : '',
      escapeCsv(location),
      escapeCsv(talentTypes),
      p?.experience_level?.replace('_', ' ') ?? '',
      escapeCsv(app.admin_notes ?? ''),
    ];
    rows.push(row.join(','));
  }

  return rows.join('\n');
}

export function downloadCsv(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
