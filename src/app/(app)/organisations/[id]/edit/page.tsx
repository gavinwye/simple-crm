import Link from 'next/link';
import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { organisations } from '@/db/schema';
import { requireRole } from '@/lib/auth';
import { updateOrganisation } from '@/lib/organisations';
import { OrganisationForm } from '../../new/_form';
import { buildParentOptions } from '@/lib/org-options';

export default async function EditOrganisationPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole('member');
  const { id: slugOrId } = await params;
  const rows = await db.select().from(organisations).where(eq(organisations.slug, slugOrId)).limit(1);
  if (rows.length === 0) notFound();
  const org = rows[0];

  const all = await db.select().from(organisations).orderBy(organisations.name);
  const parentOptions = buildParentOptions(all, org.id);

  const action = updateOrganisation.bind(null, org.id);

  return (
    <div className="p-8 max-w-3xl">
      <nav className="text-sm mb-4">
        <Link href="/organisations" className="text-slate-500 hover:text-slate-900">
          Organisations
        </Link>
        <span className="text-slate-400 mx-2">/</span>
        <Link href={`/organisations/${org.slug}`} className="text-slate-500 hover:text-slate-900">
          {org.commonName ?? org.name}
        </Link>
        <span className="text-slate-400 mx-2">/</span>
        <span className="text-slate-900">Edit</span>
      </nav>

      <h1 className="text-2xl font-semibold tracking-tight mb-6">Edit organisation</h1>

      <OrganisationForm
        action={action}
        organisation={org}
        submitLabel="Save changes"
        parentOptions={parentOptions}
      />
    </div>
  );
}
