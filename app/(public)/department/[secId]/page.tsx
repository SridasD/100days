import { redirect } from 'next/navigation';

// Canonical department URL is /public/department/[sec_id] — this short URL
// was an earlier duplicate route. Redirecting so there's a single source
// of truth and anyone with an old bookmark still lands on the right page.
export default async function DepartmentRedirect({
  params,
}: {
  params: Promise<{ secId: string }>;
}) {
  const { secId } = await params;
  redirect(`/public/department/${secId}`);
}
