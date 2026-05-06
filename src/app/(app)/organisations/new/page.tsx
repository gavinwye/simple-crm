import Link from 'next/link';
import { db } from '@/db';
import { organisations } from '@/db/schema';
import { requireRole } from '@/lib/auth';
import { createOrganisation } from '@/lib/organisations';
import { OrganisationForm } from './_form';
import { buildParentOptions } from '@/lib/org-options';

export default async function NewOrganisationPage() {
  await requireRole('member');
  const all = await db.select().from(organisations).orderBy(organisations.name);
  const parentOptions = buildParentOptions(all);

  return (
    <div className="p-8 max-w-3xl">
      <nav className="text-sm mb-4">
        <Link href="/organisations" className="text-slate-500 hover:text-slate-900">
          Organisations
        </Link>
        <span className="text-slate-400 mx-2">/</span>
        <span className="text-slate-900">New organisation</span>
      </nav>

      <h1 className="text-2xl font-semibold tracking-tight mb-6">New organisation</h1>

      <OrganisationForm
        action={createOrganisation}
        submitLabel="Create organisation"
        parentOptions={parentOptions}
      />
    </div>
  );
}
