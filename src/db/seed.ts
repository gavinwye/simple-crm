// Seed the local database with the prototype's fictional data.
// Run with: npm run db:seed (it will wipe and recreate the contents).

import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from './schema';
import { randomUUID } from 'node:crypto';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL environment variable is required');
const client = neon(url);
const db = drizzle(client, { schema });

const id = () => randomUUID();
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000);
const daysFromNow = (n: number) => new Date(Date.now() + n * 86400000);

async function main() {
  console.log('Seeding database…');

  // Clear in dependency order
  await db.delete(schema.actionItems);
  await db.delete(schema.interactionParticipants);
  await db.delete(schema.interactionInternalAttendees);
  await db.delete(schema.interactions);
  await db.delete(schema.contacts);
  await db.delete(schema.organisations);
  await db.delete(schema.projects);
  await db.delete(schema.sessions);
  await db.delete(schema.auditLog);
  await db.delete(schema.users);

  // --- Users ---
  const abisolaId = id();
  const rohanId = id();
  const ngozi = id();

  await db.insert(schema.users)
    .values([
      {
        id: abisolaId,
        email: 'abisola@govtech.gov.bb',
        name: 'Abisola Fatokun',
        role: 'admin',
        avatarColour: 'amber',
      },
      {
        id: rohanId,
        email: 'rohan.marshall@govtech.gov.bb',
        name: 'Rohan Marshall',
        role: 'member',
        avatarColour: 'emerald',
      },
      {
        id: ngozi,
        email: 'ngozi.adeyemi@govtech.gov.bb',
        name: 'Ngozi Adeyemi',
        role: 'viewer',
        avatarColour: 'violet',
      },
    ])
    ;

  // --- Organisations ---
  // Ministries
  const mistId = id();
  const mofId = id();
  const mohId = id();
  // Departments under MIST
  const mistDigitalGovId = id();
  const mistCyberId = id();
  // Department under MoF
  const mofTreasuryId = id();
  // Statutory bodies / agencies
  const braId = id();
  const nisId = id();
  // Vendors / partners
  const awsId = id();
  const msId = id();
  const undpId = id();
  const cdbId = id();
  const idbId = id();

  await db.insert(schema.organisations)
    .values([
      // Ministries (no parent)
      { id: mistId, slug: 'mist', name: 'Min. of Innovation, Science and Smart Technology', commonName: 'MIST', type: 'ministry', tags: ['priority', 'digital-id'], website: 'mist.gov.bb', createdBy: abisolaId },
      { id: mofId, slug: 'mof', name: 'Min. of Finance, Economic Affairs and Investment', commonName: 'MoF', type: 'ministry', tags: ['budget'], createdBy: abisolaId },
      { id: mohId, slug: 'moh', name: 'Min. of Health and Wellness', commonName: 'MoH', type: 'ministry', tags: ['dormant'], createdBy: abisolaId },
      // Departments
      { id: mistDigitalGovId, slug: 'mist-digital-government', name: 'Digital Government Department', commonName: 'Digital Government', type: 'department', parentId: mistId, tags: ['digital-id'], createdBy: abisolaId },
      { id: mistCyberId, slug: 'mist-cybersecurity-unit', name: 'National Cybersecurity Unit', commonName: 'Cybersecurity Unit', type: 'department', parentId: mistId, tags: ['cyber'], createdBy: abisolaId },
      { id: mofTreasuryId, slug: 'mof-treasury', name: 'Treasury Department', commonName: 'Treasury', type: 'department', parentId: mofId, tags: [], createdBy: abisolaId },
      // Statutory bodies / agencies (some with a parent ministry, some standalone)
      { id: braId, slug: 'bra', name: 'Barbados Revenue Authority', commonName: 'BRA', type: 'statutory_body', parentId: mofId, tags: ['g2g-payments'], createdBy: abisolaId },
      { id: nisId, slug: 'nis', name: 'National Insurance Department', commonName: 'NIS', type: 'agency', tags: ['identity'], createdBy: abisolaId },
      // Vendors and partners (no parent)
      { id: awsId, slug: 'aws-caribbean', name: 'AWS Caribbean', commonName: 'AWS', type: 'vendor', tags: ['cloud', 'infra'], createdBy: abisolaId },
      { id: msId, slug: 'microsoft-caribbean', name: 'Microsoft Caribbean', commonName: 'Microsoft', type: 'vendor', tags: ['licensing'], createdBy: abisolaId },
      { id: undpId, slug: 'undp', name: 'UNDP Barbados & the Eastern Caribbean', commonName: 'UNDP', type: 'multilateral', tags: ['funding'], createdBy: abisolaId },
      { id: cdbId, slug: 'cdb', name: 'Caribbean Development Bank', commonName: 'CDB', type: 'multilateral', tags: [], createdBy: abisolaId },
      { id: idbId, slug: 'idb', name: 'Inter-American Development Bank', commonName: 'IDB', type: 'multilateral', tags: [], createdBy: abisolaId },
    ])
    ;

  // --- Projects ---
  const digitalIdProjectId = id();
  const g2gProjectId = id();
  const cloudProjectId = id();
  const openDataProjectId = id();

  await db.insert(schema.projects)
    .values([
      { id: digitalIdProjectId, name: 'Digital ID', description: 'TridentID expansion across MDAs', status: 'active', leadUserId: abisolaId },
      { id: g2gProjectId, name: 'G2G Payments', description: 'Government-to-government payment rails', status: 'active', leadUserId: rohanId },
      { id: cloudProjectId, name: 'Cloud migration', description: 'Phased migration of legacy MDA systems', status: 'planning', leadUserId: abisolaId },
      { id: openDataProjectId, name: 'Open Data Portal', description: 'Public data publication pipeline', status: 'planning', leadUserId: rohanId },
    ])
    ;

  // --- Contacts ---
  const sandraId = id();
  const marcusId = id();
  const anikaId = id();
  const davidId = id();
  const carolynId = id();
  const kareemId = id();
  const patriceId = id();
  const trevorId = id();
  const janelleId = id();
  const reneeId = id();
  const dwayneId = id();
  const naomiId = id();
  const rohanFordeId = id();
  const jamalId = id();

  await db.insert(schema.contacts)
    .values([
      { id: sandraId, slug: 'sandra-husbands', fullName: 'Sandra Husbands', title: 'Chief Information Officer', organisationId: mistId, primaryEmail: 'sandra.husbands@mist.gov.bb', phone: '+1 246 555 0142', tags: ['champion', 'digital-id', 'warm'], avatarColour: 'blue', createdBy: abisolaId },
      { id: marcusId, slug: 'marcus-bynoe', fullName: 'Marcus Bynoe', title: 'Permanent Secretary', organisationId: mofId, primaryEmail: 'marcus.bynoe@finance.gov.bb', sensitive: true, tags: ['decision-maker'], avatarColour: 'rose', createdBy: abisolaId },
      { id: anikaId, slug: 'anika-phillips', fullName: 'Anika Phillips', title: 'Programme Manager', organisationId: braId, primaryEmail: 'anika.phillips@bra.gov.bb', tags: ['delivery', 'g2g-payments'], avatarColour: 'violet', createdBy: abisolaId },
      { id: davidId, slug: 'david-greaves', fullName: 'David Greaves', title: 'Account Director', organisationId: awsId, primaryEmail: 'dgreaves@amazon.com', tags: ['vendor', 'warm'], avatarColour: 'amber', createdBy: abisolaId },
      { id: carolynId, slug: 'carolyn-drakes', fullName: 'Carolyn Drakes', title: 'Programme Officer', organisationId: undpId, primaryEmail: 'carolyn.drakes@undp.org', tags: ['multilateral', 'funding'], avatarColour: 'teal', createdBy: abisolaId },
      { id: kareemId, slug: 'kareem-walcott', fullName: 'Kareem Walcott', title: 'Chief Technology Officer', organisationId: braId, primaryEmail: 'kareem.walcott@bra.gov.bb', tags: ['champion', 'technical'], avatarColour: 'fuchsia', createdBy: abisolaId },
      { id: patriceId, slug: 'patrice-boyce', fullName: 'Patrice Boyce', title: 'Director of Digital Transformation', organisationId: mohId, primaryEmail: 'patrice.boyce@health.gov.bb', tags: ['cold'], avatarColour: 'slate', createdBy: abisolaId },
      { id: trevorId, slug: 'trevor-lashley', fullName: 'Trevor Lashley', title: 'Senior Solutions Architect', organisationId: msId, primaryEmail: 'trevor.lashley@microsoft.com', tags: ['vendor'], avatarColour: 'cyan', createdBy: abisolaId },
      { id: janelleId, slug: 'janelle-reid', fullName: 'Janelle Reid', title: 'Senior Operations Officer', organisationId: cdbId, primaryEmail: 'jreid@caribank.org', tags: ['multilateral'], avatarColour: 'pink', createdBy: abisolaId },
      { id: reneeId, slug: 'renee-codrington', fullName: 'Renee Codrington', title: 'Senior Policy Analyst', organisationId: mofId, primaryEmail: 'renee.codrington@finance.gov.bb', tags: ['policy'], avatarColour: 'orange', createdBy: abisolaId },
      { id: dwayneId, slug: 'dwayne-mottley', fullName: 'Dwayne Mottley', title: 'Director, Digital Government', organisationId: mistDigitalGovId, primaryEmail: 'dwayne.mottley@mist.gov.bb', tags: [], avatarColour: 'violet', createdBy: abisolaId },
      { id: naomiId, slug: 'naomi-greenidge', fullName: 'Naomi Greenidge', title: 'Senior Policy Officer', organisationId: mistId, primaryEmail: 'naomi.greenidge@mist.gov.bb', tags: [], avatarColour: 'amber', createdBy: abisolaId },
      { id: rohanFordeId, slug: 'rohan-forde', fullName: 'Rohan Forde', title: 'Procurement Lead', organisationId: mistId, primaryEmail: 'rohan.forde@mist.gov.bb', tags: ['procurement'], avatarColour: 'teal', createdBy: abisolaId },
      { id: jamalId, slug: 'jamal-greenidge', fullName: 'Jamal Greenidge', title: 'Cabinet Liaison Officer', organisationId: mistId, primaryEmail: 'jamal.greenidge@mist.gov.bb', tags: ['new'], avatarColour: 'amber', createdBy: abisolaId },
    ])
    ;

  // --- Interactions ---
  const m1Id = id(); // Digital ID quarterly review (23 Apr)
  const m2Id = id(); // AWS architecture working session (21 Apr)
  const m3Id = id(); // MoU drafting working session (18 Apr)
  const m4Id = id(); // Intro: GovTech x BRA (17 Apr)
  const m5Id = id(); // UNDP digital strategy alignment (15 Apr)
  const e1Id = id(); // Re: TridentID rollout — needs review
  const e2Id = id(); // Funding window – Caribbean Digital Acceleration
  const n1Id = id(); // Note on Sandra

  await db.insert(schema.interactions)
    .values([
      {
        id: m1Id,
        kind: 'meeting',
        occurredAt: daysAgo(7),
        title: 'Digital ID quarterly review',
        location: 'Worthing Corporate Centre, Room 4',
        durationMinutes: 90,
        projectId: digitalIdProjectId,
        tags: ['digital-id', 'quarterly-review', 'cabinet'],
        body: `## Discussion

- Sandra (MIST) tabled the cabinet-approved phased rollout plan.
- BRA capacity to receive identity assertions in May was a concern – Kareem confirmed two of three integrations are tested.
- PS Bynoe asked about the cost envelope; Abisola to share refreshed model.

## Decisions

- Extend pilot by six weeks to capture off-island registration window.
- MIST funds the extension from existing budget.
- Phase 2 (healthcare) provisionally August, gated on DPIA sign-off.`,
        decisions: [
          'Extend pilot by six weeks to capture off-island registration window.',
          'MIST funds the extension from existing budget.',
          'Phase 2 (healthcare) provisionally August, gated on DPIA sign-off.',
        ],
        createdBy: abisolaId,
      },
      {
        id: m2Id,
        kind: 'meeting',
        occurredAt: daysAgo(9),
        title: 'AWS architecture working session',
        location: 'Google Meet',
        durationMinutes: 60,
        projectId: cloudProjectId,
        tags: ['aws', 'architecture'],
        body: 'Walked through the proposed multi-account landing zone. Identified five workloads to lift first. David to share refreshed pricing for the GovCloud equivalent in `us-east-1`.',
        createdBy: abisolaId,
      },
      {
        id: m3Id,
        kind: 'meeting',
        occurredAt: daysAgo(12),
        title: 'MoU drafting working session',
        location: 'Google Meet',
        durationMinutes: 60,
        projectId: digitalIdProjectId,
        tags: ['mou', 'legal'],
        body: 'Walked through draft MoU clauses. Sandra raised concerns about §7 (data sharing with BRA) – suggests carve-out for tax data until DPIA is signed off. Action: revise §7 and recirculate.',
        createdBy: abisolaId,
      },
      {
        id: m4Id,
        kind: 'meeting',
        occurredAt: daysAgo(13),
        title: 'Intro: GovTech × BRA modernisation',
        location: 'BRA HQ',
        durationMinutes: 60,
        tags: ['intro', 'g2g-payments'],
        body: 'Initial introduction. Kareem walked us through the BRA roadmap. Identified two integration points with the Digital ID rollout.',
        createdBy: abisolaId,
      },
      {
        id: m5Id,
        kind: 'meeting',
        occurredAt: daysAgo(15),
        title: 'UNDP digital strategy alignment',
        location: 'Hilton Barbados',
        durationMinutes: 90,
        tags: ['undp', 'funding'],
        body: 'Carolyn outlined the Caribbean Digital Acceleration funding window opening in Q3. Worth a concept note on data foundations.',
        createdBy: abisolaId,
      },
      {
        id: e1Id,
        kind: 'email',
        occurredAt: daysAgo(8),
        title: 'Re: TridentID rollout — phased approach',
        emailMessageId: '<2026-04-22-mist-001@mist.gov.bb>',
        emailFromAddress: 'sandra.husbands@mist.gov.bb',
        reviewStatus: 'pending',
        projectId: digitalIdProjectId,
        summary:
          'Sandra confirms cabinet has approved a phased TridentID rollout. Phase 1 starts in May covering BRA and NIS; phase 2 in August adding healthcare. She asks for a refreshed risk register and a draft comms plan ahead of the May ExCo.',
        body: `Hi Abisola,

Following our session on Friday, I'm pleased to confirm Cabinet has approved the phased rollout we discussed. The shape of it:

Phase 1 — May: BRA and NIS, covering the integrations Kareem's team has already tested. We'll begin with internal staff before opening up to the public on the 15th.

Phase 2 — August: Adding the Min. of Health touchpoints once the DPIA has been signed off and the Health Authority's identity-broker work is in production.

Could I ask for two things ahead of the May ExCo: a refreshed risk register reflecting the off-island registration window, and a draft comms plan with the press team's input. Happy to discuss either over a call this week.

Kind regards,
Sandra`,
        decisions: ['Cabinet has approved a phased TridentID rollout (May / August)'],
        createdBy: abisolaId,
      },
      {
        id: e2Id,
        kind: 'email',
        occurredAt: daysAgo(11),
        title: 'Funding window — Caribbean Digital Acceleration',
        emailMessageId: '<2026-04-19-undp-001@undp.org>',
        emailFromAddress: 'carolyn.drakes@undp.org',
        reviewStatus: 'confirmed',
        summary:
          'Carolyn shares the upcoming Caribbean Digital Acceleration funding window. Concept notes due by 14 June; up to USD 250k available.',
        body: 'Sharing the call we discussed at the Hilton. Concept notes by 14 June; happy to review a draft if useful.',
        createdBy: abisolaId,
      },
      {
        id: n1Id,
        kind: 'note',
        occurredAt: daysAgo(18),
        title: 'On Sandra Husbands',
        body: 'Sandra mentioned at the GDS conference that she is open to a knowledge-exchange visit with the Estonian e-government team in Q3. Worth following up after Cabinet has approved the strategy.',
        createdBy: abisolaId,
      },
    ])
    ;

  // --- Participants ---
  await db.insert(schema.interactionParticipants)
    .values([
      // Meeting 1 — Digital ID quarterly review
      { interactionId: m1Id, contactId: sandraId, role: 'attendee' },
      { interactionId: m1Id, contactId: marcusId, role: 'attendee' },
      { interactionId: m1Id, contactId: kareemId, role: 'attendee' },
      { interactionId: m1Id, contactId: jamalId, role: 'attendee' },
      // Meeting 2 — AWS
      { interactionId: m2Id, contactId: davidId, role: 'attendee' },
      // Meeting 3 — MoU
      { interactionId: m3Id, contactId: sandraId, role: 'attendee' },
      { interactionId: m3Id, contactId: dwayneId, role: 'attendee' },
      // Meeting 4 — Intro BRA
      { interactionId: m4Id, contactId: kareemId, role: 'attendee' },
      { interactionId: m4Id, contactId: anikaId, role: 'attendee' },
      // Meeting 5 — UNDP
      { interactionId: m5Id, contactId: carolynId, role: 'attendee' },
      // Email 1 — TridentID
      { interactionId: e1Id, contactId: sandraId, role: 'sender' },
      { interactionId: e1Id, contactId: marcusId, role: 'cc' },
      { interactionId: e1Id, contactId: kareemId, role: 'cc' },
      // Email 2 — UNDP funding
      { interactionId: e2Id, contactId: carolynId, role: 'sender' },
      // Note — about Sandra
      { interactionId: n1Id, contactId: sandraId, role: 'attendee' },
    ])
    ;

  // --- Internal attendees (GovTech) ---
  await db.insert(schema.interactionInternalAttendees)
    .values([
      { interactionId: m1Id, userId: abisolaId },
      { interactionId: m1Id, userId: rohanId },
      { interactionId: m2Id, userId: abisolaId },
      { interactionId: m3Id, userId: abisolaId },
      { interactionId: m4Id, userId: abisolaId },
      { interactionId: m5Id, userId: abisolaId },
    ])
    ;

  // --- Action items ---
  await db.insert(schema.actionItems)
    .values([
      {
        id: id(),
        interactionId: m3Id,
        description: 'Send draft MoU to MIST legal',
        ownerUserId: abisolaId,
        dueDate: daysAgo(2), // overdue
        status: 'open',
      },
      {
        id: id(),
        interactionId: m1Id,
        description: 'Send refreshed cost model to PS Bynoe',
        ownerUserId: abisolaId,
        dueDate: daysFromNow(2),
        status: 'open',
      },
      {
        id: id(),
        interactionId: m1Id,
        description: 'Update risk register for phase 1',
        ownerUserId: rohanId,
        dueDate: daysAgo(2),
        status: 'done',
        completedAt: daysAgo(2),
      },
      {
        id: id(),
        interactionId: m1Id,
        description: 'Confirm DPIA owner with MIST legal',
        ownerContactId: sandraId,
        dueDate: daysAgo(4),
        status: 'done',
        completedAt: daysAgo(4),
      },
      {
        id: id(),
        interactionId: m2Id,
        description: 'Share AWS pricing model with finance',
        ownerUserId: abisolaId,
        dueDate: daysFromNow(2),
        status: 'open',
      },
      {
        id: id(),
        interactionId: m1Id,
        description: 'Schedule follow-up with PS Bynoe re: budget cycle',
        ownerUserId: abisolaId,
        dueDate: daysFromNow(5),
        status: 'open',
      },
      {
        id: id(),
        interactionId: m5Id,
        description: 'Confirm UNDP grant timeline',
        ownerUserId: abisolaId,
        dueDate: daysFromNow(8),
        status: 'open',
      },
      {
        id: id(),
        interactionId: e1Id,
        description: 'Refresh risk register for off-island registration window',
        ownerUserId: abisolaId,
        dueDate: daysFromNow(8),
        status: 'open',
      },
      {
        id: id(),
        interactionId: e1Id,
        description: 'Draft comms plan with press team input',
        ownerUserId: rohanId,
        dueDate: daysFromNow(12),
        status: 'open',
      },
    ])
    ;

  console.log('Seed complete.');
  console.log(`Users:         3`);
  console.log(`Organisations: 13 (3 ministries, 3 departments, 1 statutory body, 1 agency, 5 external)`);
  console.log(`Contacts:      14`);
  console.log(`Projects:      4`);
  console.log(`Interactions:  8`);
  console.log(`Action items:  9`);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
