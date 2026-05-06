import { sql } from 'drizzle-orm';
import { db, dbAll } from '@/db';
import { requireRole } from '@/lib/auth';
import { addTeamMember } from '@/lib/users';
import { avatarClasses, initials, formatDateTime } from '@/lib/utils';
import { TeamRoleSelect } from './_role-select';

export default async function TeamSettingsPage() {
  const actor = await requireRole('admin');

  const rows = await dbAll<{
    id: string;
    name: string;
    email: string;
    role: string;
    avatar_colour: string;
    created_at: number;
    last_session: number | null;
  }>(sql`
    SELECT u.id, u.name, u.email, u.role, u.avatar_colour, u.created_at,
      (SELECT MAX(s.created_at) FROM sessions s WHERE s.user_id = u.id) AS last_session
    FROM users u
    ORDER BY u.role ASC, u.name ASC
  `);

  return (
    <div className="space-y-8">
      <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Team members</h2>
            <p className="text-xs text-slate-500 mt-0.5">{rows.length} {rows.length === 1 ? 'person' : 'people'}</p>
          </div>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr className="text-left text-xs uppercase tracking-wider text-slate-500">
              <th className="px-5 py-3 font-medium">Name</th>
              <th className="px-5 py-3 font-medium">Role</th>
              <th className="px-5 py-3 font-medium">Last sign-in</th>
              <th className="px-5 py-3 font-medium">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((u) => {
              const colour = avatarClasses(u.avatar_colour);
              const isSelf = u.id === actor.id;
              return (
                <tr key={u.id}>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-full ${colour.bg} ${colour.text} flex items-center justify-center text-xs font-semibold`}>
                        {initials(u.name)}
                      </div>
                      <div>
                        <div className="font-medium">
                          {u.name}
                          {isSelf && <span className="ml-2 text-[11px] text-slate-500">(you)</span>}
                        </div>
                        <div className="text-xs text-slate-500">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <TeamRoleSelect userId={u.id} currentRole={u.role} disabled={isSelf} />
                  </td>
                  <td className="px-5 py-3 text-slate-600 text-xs">
                    {u.last_session
                      ? formatDateTime(new Date(u.last_session * 1000))
                      : <span className="text-slate-400">never</span>}
                  </td>
                  <td className="px-5 py-3 text-slate-600 text-xs">
                    {formatDateTime(new Date(u.created_at * 1000))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="bg-white border border-slate-200 rounded-lg p-6">
        <h2 className="font-semibold mb-1">Add a team member</h2>
        <p className="text-xs text-slate-500 mb-4">
          Creates a user record so the new person can sign in. With Google Workspace OAuth they sign in
          using the email below; without it, they appear on the dev sign-in picker.
        </p>
        <form action={addTeamMember} className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
              Name
            </label>
            <input
              type="text"
              name="name"
              required
              placeholder="e.g. Tomi Adekunle"
              className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
              Email
            </label>
            <input
              type="email"
              name="email"
              required
              placeholder="name@govtech.gov.bb"
              className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
              Role
            </label>
            <select
              name="role"
              defaultValue="member"
              className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm bg-white"
            >
              <option value="admin">Admin – manage everything</option>
              <option value="member">Member – read & write</option>
              <option value="viewer">Viewer – read only</option>
            </select>
          </div>
          <div className="col-span-3 flex items-center justify-between pt-2">
            <p className="text-xs text-slate-500">
              No invite email is sent. Tell the person to sign in once you've added them.
            </p>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white rounded-md text-sm font-medium hover:bg-slate-800"
            >
              Add member
            </button>
          </div>
        </form>
      </section>

      <section className="text-xs text-slate-500 px-1">
        <p className="mb-1"><span className="font-medium text-slate-700">Roles:</span></p>
        <ul className="list-disc pl-5 space-y-0.5">
          <li><span className="font-medium">Admin</span> – everything, plus this Settings area and the audit log.</li>
          <li><span className="font-medium">Member</span> – can read and write contacts, organisations, meetings, action items.</li>
          <li><span className="font-medium">Viewer</span> – read only. Can see records but can't add or edit.</li>
        </ul>
      </section>
    </div>
  );
}
