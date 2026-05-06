import Link from 'next/link';
import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { contacts, organisations } from '@/db/schema';
import { requireRole } from '@/lib/auth';
import { updateContact } from '@/lib/contacts';
import { ContactForm } from '../../new/_form';

export default async function EditContactPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole('member');
  const { id: slugOrId } = await params;
  const rows = await db.select().from(contacts).where(eq(contacts.slug, slugOrId)).limit(1);
  if (rows.length === 0) notFound();
  const contact = rows[0];

  const allOrgs = await db.select().from(organisations).orderBy(organisations.name);

  const action = updateContact.bind(null, contact.id);

  return (
    <div className="p-8 max-w-3xl">
      <nav className="text-sm mb-4">
        <Link href="/contacts" className="text-slate-500 hover:text-slate-900">
          Contacts
        </Link>
        <span className="text-slate-400 mx-2">/</span>
        <Link href={`/contacts/${contact.slug}`} className="text-slate-500 hover:text-slate-900">
          {contact.fullName}
        </Link>
        <span className="text-slate-400 mx-2">/</span>
        <span className="text-slate-900">Edit</span>
      </nav>

      <h1 className="text-2xl font-semibold tracking-tight mb-6">Edit contact</h1>

      <ContactForm action={action} organisations={allOrgs} contact={contact} submitLabel="Save changes" />
    </div>
  );
}
