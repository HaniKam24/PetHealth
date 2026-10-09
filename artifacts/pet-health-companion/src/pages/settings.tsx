import { useState } from 'react';
import { useLocation } from 'wouter';
import { Trash2, Download } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useDeleteAccount, exportAccountData } from '@workspace/api-client-react';
import { signOut, useSession } from '@/lib/auth-client';

export default function Settings() {
  const [, setLocation] = useLocation();
  const { data: session } = useSession();
  const { toast } = useToast();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  const accountEmail = session?.user.email ?? '';
  // Case-sensitive on purpose — matching the exact email on screen is the
  // whole point of this confirmation, same as typing a filename to confirm
  // a delete in a desktop file manager.
  const canConfirmDelete = confirmEmail === accountEmail;

  const deleteAccount = useDeleteAccount({
    mutation: {
      onSuccess: async () => {
        await signOut();
        setLocation('/login');
      },
      onError: (error) => {
        toast({ title: "Couldn't delete your account", description: error.message, variant: 'destructive' });
      },
    },
  });

  // Same client-built-Blob approach as the dropdown menu's "Download my
  // data" — not the generated react-query hook, since this is a one-shot
  // download action rather than data to cache/subscribe to.
  const handleExportData = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const data = await exportAccountData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `pethealth-export-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast({
        title: "Couldn't export your data",
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto w-full p-6 md:p-10 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-serif font-medium text-foreground">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your account.</p>
      </div>

      <Card className="rounded-3xl shadow-sm">
        <CardHeader className="pb-2">
          <h2 className="font-serif font-medium text-foreground">Account</h2>
        </CardHeader>
        <CardContent className="pt-2">
          <p className="text-sm text-muted-foreground">Signed in as</p>
          <p className="font-medium text-foreground">{accountEmail}</p>
        </CardContent>
      </Card>

      <Card className="rounded-3xl shadow-sm">
        <CardHeader className="pb-2">
          <h2 className="font-serif font-medium text-foreground">Your data</h2>
        </CardHeader>
        <CardContent className="pt-2 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              Download a copy of everything stored about your account and your pets.
            </p>
            <button
              type="button"
              onClick={handleExportData}
              disabled={isExporting}
              className="h-10 px-4 flex items-center gap-2 rounded-full border border-border font-semibold text-sm hover:bg-accent transition-colors disabled:opacity-50 shrink-0"
            >
              <Download size={16} />
              {isExporting ? 'Preparing…' : 'Download'}
            </button>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-3xl shadow-sm border-destructive/30">
        <CardHeader className="pb-2">
          <h2 className="font-serif font-medium text-destructive">Danger zone</h2>
        </CardHeader>
        <CardContent className="pt-2 flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            Permanently delete your account and everything in it. This can't be undone.
          </p>
          <button
            type="button"
            onClick={() => setIsDeleteDialogOpen(true)}
            className="h-10 px-4 flex items-center gap-2 rounded-full border border-destructive/30 text-destructive font-semibold text-sm hover:bg-destructive/10 transition-colors shrink-0"
          >
            <Trash2 size={16} />
            Delete account
          </button>
        </CardContent>
      </Card>

      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={(open) => {
          setIsDeleteDialogOpen(open);
          if (!open) setConfirmEmail('');
        }}
      >
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your account?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes your account and every pet only you own, along with their health records,
              medications, reminders, and uploaded documents. This can't be undone. A pet you share with someone
              else stays intact for them — you're just removed as one of its owners.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirm-email">
              Type <span className="font-semibold text-foreground">{accountEmail}</span> to confirm
            </Label>
            <Input
              id="confirm-email"
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              autoComplete="off"
              className="rounded-full"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full" disabled={deleteAccount.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={!canConfirmDelete || deleteAccount.isPending}
              onClick={() => deleteAccount.mutate()}
              className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteAccount.isPending ? 'Deleting…' : 'Delete account'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
