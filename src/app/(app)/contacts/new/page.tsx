import Link from 'next/link';
import { db } from '@/db';
import { organisations } from '@/db/schema';
import { requireRole } from '@/lib/auth';
import { createContact } from '@/lib/contacts';
import { ContactForm } from './_form';

export default async function NewContactPage() {
  await requireRole('member');
  const allOrgs = await db.select().from(organisations).orderBy(organisations.name);

  return (
    <div className="p-8 max-w-3xl">
      <nav className="text-sm mb-4">
        <Link href="/contacts" className="text-slate-500 hover:text-slate-900">
          Contacts
        </Link>
        <span className="text-slate-400 mx-2">/</span>
        <span className="text-slate-900">New contact</span>
      </nav>

      <h1 className="text-2xl font-semibold tracking-tight mb-6">New contact</h1>

      <ContactForm action={createContact} organisations={allOrgs} submitLabel="Create contact" />
    </div>
  );
}
