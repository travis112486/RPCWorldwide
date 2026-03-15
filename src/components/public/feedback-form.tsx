'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

interface FeedbackFormProps {
  token: string;
  applicationId: string;
  password?: string;
  onSubmitted: () => void;
}

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);

  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          className="p-0.5 transition-colors"
          aria-label={`Rate ${star} star${star !== 1 ? 's' : ''}`}
        >
          <svg
            className={`h-6 w-6 ${
              star <= (hover || value)
                ? 'fill-amber-400 text-amber-400'
                : 'fill-none text-neutral-300'
            }`}
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
            />
          </svg>
        </button>
      ))}
    </div>
  );
}

export function FeedbackForm({ token, applicationId, password, onSubmitted }: FeedbackFormProps) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [viewerName, setViewerName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rating === 0 && !comment.trim()) {
      setError('Please provide a rating or comment');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (password) headers['X-Presentation-Password'] = password;

      const res = await fetch(`/api/presentations/${token}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          applicationId,
          rating: rating > 0 ? rating : undefined,
          comment: comment.trim() || undefined,
          viewerName: viewerName.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to submit feedback');
        setSubmitting(false);
        return;
      }

      setSubmitted(true);
      onSubmitted();
    } catch {
      setError('Network error. Please try again.');
    }
    setSubmitting(false);
  }

  if (submitted) {
    return (
      <div className="rounded-lg bg-green-50 p-4 text-center">
        <p className="text-sm font-medium text-green-800">Thank you for your feedback!</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
      <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Your Feedback</p>

      <div className="space-y-1">
        <p className="text-xs text-neutral-500">Rating</p>
        <StarRating value={rating} onChange={setRating} />
      </div>

      <Textarea
        id={`comment-${applicationId}`}
        placeholder="Leave a comment..."
        rows={2}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        className="text-sm"
      />

      <Input
        id={`viewerName-${applicationId}`}
        placeholder="Your name (optional)"
        value={viewerName}
        onChange={(e) => setViewerName(e.target.value)}
        className="text-sm"
      />

      {error && <p className="text-xs text-red-600">{error}</p>}

      <Button type="submit" size="sm" loading={submitting} disabled={submitting} className="w-full">
        Submit Feedback
      </Button>
    </form>
  );
}
