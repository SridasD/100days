import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UserForm } from '@/components/forms/UserForm';

// Section 7.8 — Create user. POSTs to /api/admin/users.
export default function AdminUserNewPage() {
  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Create User</h1>
          <p className="text-sm text-muted-foreground">
            Add a Nodal Officer, Verification Officer, or Admin account.
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="cursor-pointer">
          <Link href="/admin/users">
            <ArrowLeft className="h-4 w-4" />
            Back to users
          </Link>
        </Button>
      </div>

      <UserForm />
    </main>
  );
}
