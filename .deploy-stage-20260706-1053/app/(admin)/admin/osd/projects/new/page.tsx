import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ProjectForm } from '@/components/forms/ProjectForm';
import { Button } from '@/components/ui/button';

export default function OsdProjectNewPage() {
    return (
        <main className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Add Project</h1>
                    <p className="text-sm text-muted-foreground">
                        Create a new master project and assign it to a department.
                    </p>
                </div>
                <Button asChild variant="outline" size="sm" className="cursor-pointer">
                    <Link href="/admin/osd/projects">
                        <ArrowLeft className="h-4 w-4" />
                        Back to projects
                    </Link>
                </Button>
            </div>

            <ProjectForm redirectTo="/admin/osd/projects" />
        </main>
    );
}