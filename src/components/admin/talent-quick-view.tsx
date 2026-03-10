'use client';

import { useState } from 'react';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import type { ApplicationRow } from '@/components/admin/applicant-card';

interface TalentQuickViewProps {
  application: ApplicationRow;
  avatarUrl: string | null;
  onNotesUpdated: (appId: string, notes: string) => void;
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

export function TalentQuickView({ application: app, avatarUrl, onNotesUpdated, onClose }: TalentQuickViewProps) {
  const p = app.profiles;
  const name = p?.display_name || `${p?.first_name ?? ''} ${p?.last_name ?? ''}`.trim() || 'Unknown';
  const [adminNotes, setAdminNotes] = useState(app.admin_notes ?? '');
  const [saving, setSaving] = useState(false);

  const supabase = createClient();
  const { toast } = useToast();

  async function saveNotes() {
    setSaving(true);
    const { error } = await supabase
      .from('applications')
      .update({ admin_notes: adminNotes })
      .eq('id', app.id);
    setSaving(false);

    if (error) {
      toast('Failed to save notes', 'error');
      return;
    }
    onNotesUpdated(app.id, adminNotes);
    toast('Notes saved', 'success');
  }

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4 animate-in slide-in-from-top-2 duration-200">
      <div className="flex items-start gap-4">
        {/* Headshot */}
        <div className="shrink-0">
          {avatarUrl ? (
            <Image src={avatarUrl} alt={name} width={96} height={128} className="h-32 w-24 rounded-lg object-cover" />
          ) : (
            <div className="flex h-32 w-24 items-center justify-center rounded-lg bg-muted text-lg font-bold text-muted-foreground">
              {((p?.first_name?.[0] ?? '') + (p?.last_name?.[0] ?? '')).toUpperCase() || '?'}
            </div>
          )}
        </div>

        {/* Details */}
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-foreground">{name}</h4>
            <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
            {p?.gender && (
              <div>
                <span className="font-medium text-muted-foreground">Gender</span>
                <p className="capitalize text-foreground">{p.gender.replace('_', ' ')}</p>
              </div>
            )}
            {p?.height_cm && (
              <div>
                <span className="font-medium text-muted-foreground">Height</span>
                <p className="text-foreground">{cmToFeetInches(p.height_cm)}</p>
              </div>
            )}
            {p?.weight_kg && (
              <div>
                <span className="font-medium text-muted-foreground">Weight</span>
                <p className="text-foreground">{p.weight_kg} kg</p>
              </div>
            )}
            {(p?.city || p?.state) && (
              <div>
                <span className="font-medium text-muted-foreground">Location</span>
                <p className="truncate text-foreground">{[p.city, p.state].filter(Boolean).join(', ')}</p>
              </div>
            )}
          </div>

          {/* Talent types */}
          {p?.talent_type && p.talent_type.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {p.talent_type.map((t) => (
                <Badge key={t} variant="secondary" className="text-[10px]">{talentTypeLabels[t] ?? t}</Badge>
              ))}
            </div>
          )}

          {/* Experience */}
          {p?.experience_level && (
            <p className="text-xs text-muted-foreground">Experience: <span className="capitalize text-foreground">{p.experience_level.replace('_', ' ')}</span></p>
          )}

          {/* Bio */}
          {p?.bio && (
            <p className="text-xs text-muted-foreground line-clamp-3">{p.bio}</p>
          )}
        </div>
      </div>

      {/* Admin notes */}
      <div className="mt-3 border-t border-border pt-3">
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Admin Notes</label>
        <Textarea
          id={`qv-notes-${app.id}`}
          rows={2}
          placeholder="Internal notes about this applicant..."
          value={adminNotes}
          onChange={(e) => setAdminNotes(e.target.value)}
          className="text-xs"
        />
        <div className="mt-2 flex justify-end">
          <Button size="sm" onClick={saveNotes} loading={saving} className="h-7 text-xs">
            Save Notes
          </Button>
        </div>
      </div>
    </div>
  );
}
