import {
  useGetShareLink,
  getGetShareLinkQueryKey,
  useCreateShareLink,
  useRevokeShareLink,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Share2, Copy } from 'lucide-react';
import { format } from 'date-fns';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

// Standalone card, not part of the profile form — creating/revoking a link
// takes effect immediately, same reasoning as the delete-pet action, rather
// than being staged behind "Save changes".
export function ShareLinkCard({ petId, petName }: { petId: number; petName: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [endDate, setEndDate] = useState('');

  const { data: shareLink, isLoading } = useGetShareLink(petId, {
    query: { queryKey: getGetShareLinkQueryKey(petId) },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getGetShareLinkQueryKey(petId) });

  const createLink = useCreateShareLink({
    mutation: {
      onSuccess: () => {
        invalidate();
        setEndDate('');
        toast({ title: 'Share link created' });
      },
      onError: (error) => toast({ title: "Couldn't create link", description: error.message, variant: 'destructive' }),
    },
  });

  const revokeLink = useRevokeShareLink({
    mutation: {
      onSuccess: () => {
        invalidate();
        toast({ title: 'Share link revoked' });
      },
      onError: (error) => toast({ title: "Couldn't revoke link", description: error.message, variant: 'destructive' }),
    },
  });

  const handleCreate = () => {
    if (!endDate) return;
    createLink.mutate({ petId, data: { expiresAt: new Date(`${endDate}T23:59:59`).toISOString() } });
  };

  const handleCopy = async () => {
    if (!shareLink) return;
    try {
      await navigator.clipboard.writeText(shareLink.url);
      toast({ title: 'Link copied' });
    } catch {
      toast({ title: "Couldn't copy", description: 'Your browser blocked clipboard access.', variant: 'destructive' });
    }
  };

  return (
    <div className="bg-card border border-border rounded-3xl p-6">
      <div className="flex items-center gap-2 mb-1">
        <Share2 size={18} className="text-primary" />
        <div className="font-serif text-lg font-extrabold">Share care info with a sitter</div>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        A read-only link with {petName}'s vet contact, active medications, and notes — no account needed to view it.
      </p>

      {isLoading ? null : shareLink ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={shareLink.url}
              className="flex-1 h-11 px-3.5 rounded-xl bg-accent/40 border border-border text-sm truncate"
            />
            <button
              type="button"
              onClick={handleCopy}
              className="h-11 px-4 flex items-center gap-1.5 rounded-xl border border-border text-sm font-bold hover:bg-accent transition-colors shrink-0"
            >
              <Copy size={14} /> Copy
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Active until {format(new Date(shareLink.expiresAt), 'MMMM d, yyyy')} ·{' '}
            {shareLink.lastViewedAt
              ? `last viewed ${format(new Date(shareLink.lastViewedAt), 'MMM d, h:mm a')}`
              : 'not yet opened'}
          </p>
          <button
            type="button"
            onClick={() => revokeLink.mutate({ petId })}
            disabled={revokeLink.isPending}
            className="self-start text-sm font-bold text-destructive hover:underline disabled:opacity-50"
          >
            Revoke link
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="h-11 px-3.5 rounded-xl bg-accent/40 border border-border text-sm"
            aria-label="Share link valid through"
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={!endDate || createLink.isPending}
            className="h-11 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            Create link
          </button>
        </div>
      )}
    </div>
  );
}
