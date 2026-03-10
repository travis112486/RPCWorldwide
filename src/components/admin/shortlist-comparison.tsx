'use client';

import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import type { ApplicationRow } from '@/components/admin/applicant-card';

interface ShortlistComparisonProps {
  applications: ApplicationRow[];
  avatars: Record<string, string>;
  open: boolean;
  onClose: () => void;
}

const talentTypeLabels: Record<string, string> = {
  model: 'Model', actor: 'Actor', voice_actor: 'Voice', dancer: 'Dancer',
  singer: 'Singer', extra: 'Extra', other: 'Other',
};

function cmToFeetInches(cm: number): string {
  const totalInches = cm / 2.54;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  return `${feet}'${inches}"`;
}

function AttributeRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <tr className="border-b border-border">
      <td className="whitespace-nowrap py-2 pr-3 text-xs font-medium text-muted-foreground">{label}</td>
      {children}
    </tr>
  );
}

export function ShortlistComparison({ applications, avatars, open, onClose }: ShortlistComparisonProps) {
  if (applications.length < 2 || applications.length > 4) return null;

  return (
    <Modal open={open} onClose={onClose} title="Compare Shortlisted Talent" className="max-w-5xl">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="py-2 pr-3 text-left text-xs font-medium text-muted-foreground" />
              {applications.map((app) => {
                const p = app.profiles;
                const name = p?.display_name || `${p?.first_name ?? ''} ${p?.last_name ?? ''}`.trim() || 'Unknown';
                return (
                  <th key={app.id} className="min-w-[160px] px-2 py-2 text-center">
                    <div className="flex flex-col items-center gap-1.5">
                      {avatars[app.user_id] ? (
                        <Image src={avatars[app.user_id]} alt={name} width={80} height={100} className="h-[100px] w-[80px] rounded-lg object-cover" />
                      ) : (
                        <div className="flex h-[100px] w-[80px] items-center justify-center rounded-lg bg-muted text-lg font-bold text-muted-foreground">
                          {((p?.first_name?.[0] ?? '') + (p?.last_name?.[0] ?? '')).toUpperCase() || '?'}
                        </div>
                      )}
                      <span className="text-sm font-semibold text-foreground">{name}</span>
                      {app.shortlist_rank != null && (
                        <Badge variant="secondary" className="text-[10px]">Rank #{app.shortlist_rank}</Badge>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            <AttributeRow label="Gender">
              {applications.map((app) => (
                <td key={app.id} className="px-2 py-2 text-center text-xs capitalize text-foreground">
                  {app.profiles?.gender?.replace('_', ' ') ?? '—'}
                </td>
              ))}
            </AttributeRow>
            <AttributeRow label="Height">
              {applications.map((app) => (
                <td key={app.id} className="px-2 py-2 text-center text-xs text-foreground">
                  {app.profiles?.height_cm ? cmToFeetInches(app.profiles.height_cm) : '—'}
                </td>
              ))}
            </AttributeRow>
            <AttributeRow label="Weight">
              {applications.map((app) => (
                <td key={app.id} className="px-2 py-2 text-center text-xs text-foreground">
                  {app.profiles?.weight_kg != null ? `${app.profiles.weight_kg} kg` : '—'}
                </td>
              ))}
            </AttributeRow>
            <AttributeRow label="Location">
              {applications.map((app) => (
                <td key={app.id} className="px-2 py-2 text-center text-xs text-foreground">
                  {[app.profiles?.city, app.profiles?.state].filter(Boolean).join(', ') || '—'}
                </td>
              ))}
            </AttributeRow>
            <AttributeRow label="Talent Type">
              {applications.map((app) => (
                <td key={app.id} className="px-2 py-2 text-center">
                  <div className="flex flex-wrap justify-center gap-0.5">
                    {app.profiles?.talent_type?.map((t) => (
                      <Badge key={t} variant="secondary" className="text-[9px]">{talentTypeLabels[t] ?? t}</Badge>
                    )) ?? <span className="text-xs text-muted-foreground">—</span>}
                  </div>
                </td>
              ))}
            </AttributeRow>
            <AttributeRow label="Experience">
              {applications.map((app) => (
                <td key={app.id} className="px-2 py-2 text-center text-xs capitalize text-foreground">
                  {app.profiles?.experience_level?.replace('_', ' ') ?? '—'}
                </td>
              ))}
            </AttributeRow>
            <AttributeRow label="Bio">
              {applications.map((app) => (
                <td key={app.id} className="px-2 py-2 text-xs text-foreground">
                  <p className="line-clamp-4 text-center">{app.profiles?.bio ?? '—'}</p>
                </td>
              ))}
            </AttributeRow>
            <AttributeRow label="Admin Notes">
              {applications.map((app) => (
                <td key={app.id} className="px-2 py-2 text-xs text-foreground">
                  <p className="line-clamp-3 text-center italic">{app.admin_notes ?? '—'}</p>
                </td>
              ))}
            </AttributeRow>
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex justify-end">
        <Button variant="ghost" onClick={onClose}>Close</Button>
      </div>
    </Modal>
  );
}
