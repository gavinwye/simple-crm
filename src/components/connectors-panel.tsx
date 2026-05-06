'use client';

import { useState, useTransition } from 'react';
import { addConnector, updateConnector, removeConnector } from '@/lib/connectors';
import { avatarClasses, initials } from '@/lib/utils';

export type ConnectorStrength = 'close' | 'professional' | 'acquaintance';

export type ConnectorRow = {
  id: string;
  userId: string;
  userName: string;
  userAvatarColour: string;
  strength: ConnectorStrength;
  notes: string | null;
};

export type ConnectorUser = {
  id: string;
  name: string;
  avatarColour: string;
};

type Props = {
  contactId: string;
  connectors: ConnectorRow[];
  allUsers: ConnectorUser[];
  currentUserId: string | null;
};

const STRENGTH_LABEL: Record<ConnectorStrength, string> = {
  close: 'Close',
  professional: 'Professional',
  acquaintance: 'Acquaintance',
};

const STRENGTH_CHIP: Record<ConnectorStrength, string> = {
  close: 'bg-emerald-50 text-emerald-700',
  professional: 'bg-blue-50 text-blue-700',
  acquaintance: 'bg-slate-100 text-slate-600',
};

const STRENGTH_HELP: Record<ConnectorStrength, string> = {
  close: 'Knows them well, can pick up the phone.',
  professional: 'Worked together, would respond to an email.',
  acquaintance: 'Met a few times, light touch only.',
};

export function ConnectorsPanel({ contactId, connectors, allUsers, currentUserId }: Props) {
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const connectedUserIds = new Set(connectors.map((c) => c.userId));
  const meAlreadyConnected = currentUserId ? connectedUserIds.has(currentUserId) : true;
  const candidates = allUsers.filter((u) => !connectedUserIds.has(u.id));

  function handleAdd(form: HTMLFormElement) {
    const data = new FormData(form);
    const userId = String(data.get('userId') ?? '');
    const strength = String(data.get('strength') ?? 'professional');
    const notes = String(data.get('notes') ?? '');
    setError(null);
    startTransition(async () => {
      try {
        await addConnector({ contactId, userId, strength, notes });
        setAdding(false);
        form.reset();
      } catch (err) {
        setError((err as Error).message);
      }
    });
  }

  function handleAddMe() {
    if (!currentUserId) return;
    setError(null);
    startTransition(async () => {
      try {
        await addConnector({
          contactId,
          userId: currentUserId,
          strength: 'professional',
          notes: '',
        });
      } catch (err) {
        setError((err as Error).message);
      }
    });
  }

  function handleUpdate(connectorId: string, form: HTMLFormElement) {
    const data = new FormData(form);
    const strength = String(data.get('strength') ?? 'professional');
    const notes = String(data.get('notes') ?? '');
    setError(null);
    startTransition(async () => {
      try {
        await updateConnector(connectorId, { strength, notes });
        setEditingId(null);
      } catch (err) {
        setError((err as Error).message);
      }
    });
  }

  function handleRemove(connectorId: string) {
    setError(null);
    startTransition(async () => {
      try {
        await removeConnector(connectorId);
      } catch (err) {
        setError((err as Error).message);
      }
    });
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-5">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Relationships
        </h3>
        <span className="text-[11px] text-slate-400">
          {connectors.length} on the team
        </span>
      </div>

      {connectors.length === 0 && !adding && (
        <p className="text-sm text-slate-500 mb-3">
          No-one on the team has flagged a relationship with this contact yet.
        </p>
      )}

      {connectors.length > 0 && (
        <ul className="space-y-3 mb-3">
          {connectors.map((c) => {
            const av = avatarClasses(c.userAvatarColour);
            const isMe = currentUserId === c.userId;
            const isEditing = editingId === c.id;
            return (
              <li key={c.id} className="flex items-start gap-2.5">
                <div
                  className={`w-7 h-7 rounded-full ${av.bg} ${av.text} flex items-center justify-center text-[10px] font-semibold flex-shrink-0`}
                >
                  {initials(c.userName)}
                </div>
                <div className="flex-1 min-w-0">
                  {isEditing ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleUpdate(c.id, e.currentTarget);
                      }}
                      className="space-y-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{c.userName}</span>
                        {isMe && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">
                            you
                          </span>
                        )}
                      </div>
                      <select
                        name="strength"
                        defaultValue={c.strength}
                        className="w-full text-xs border border-slate-200 rounded px-2 py-1.5"
                      >
                        <option value="close">Close — knows them well</option>
                        <option value="professional">Professional — worked together</option>
                        <option value="acquaintance">Acquaintance — light touch</option>
                      </select>
                      <textarea
                        name="notes"
                        defaultValue={c.notes ?? ''}
                        placeholder="How do they know each other?"
                        rows={2}
                        className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 resize-y"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          type="submit"
                          disabled={pending}
                          className="px-2.5 py-1 bg-slate-900 text-white text-xs font-medium rounded hover:bg-slate-800 disabled:bg-slate-400"
                        >
                          {pending ? 'Saving…' : 'Save'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          disabled={pending}
                          className="px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{c.userName}</span>
                        {isMe && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">
                            you
                          </span>
                        )}
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${STRENGTH_CHIP[c.strength]}`}
                          title={STRENGTH_HELP[c.strength]}
                        >
                          {STRENGTH_LABEL[c.strength]}
                        </span>
                      </div>
                      {c.notes && (
                        <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{c.notes}</p>
                      )}
                      <div className="flex items-center gap-3 mt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(c.id);
                            setError(null);
                          }}
                          className="text-[11px] text-slate-500 hover:text-slate-900"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemove(c.id)}
                          disabled={pending}
                          className="text-[11px] text-rose-600 hover:text-rose-700 disabled:text-slate-400"
                        >
                          Remove
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {error && (
        <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded px-2 py-1.5 mb-3">
          {error}
        </p>
      )}

      {!adding && (
        <div className="flex items-center gap-3 pt-1 border-t border-slate-100">
          <button
            type="button"
            onClick={() => {
              setAdding(true);
              setError(null);
            }}
            disabled={candidates.length === 0 || pending}
            className="mt-3 text-sm font-medium text-slate-700 hover:text-slate-900 disabled:text-slate-400"
          >
            + Link colleague
          </button>
          {!meAlreadyConnected && currentUserId && (
            <button
              type="button"
              onClick={handleAddMe}
              disabled={pending}
              className="mt-3 text-sm font-medium text-slate-500 hover:text-slate-900 disabled:text-slate-400"
            >
              Add me
            </button>
          )}
          {candidates.length === 0 && (
            <span className="mt-3 text-[11px] text-slate-400">Everyone on the team is already linked.</span>
          )}
        </div>
      )}

      {adding && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAdd(e.currentTarget);
          }}
          className="space-y-2 pt-3 border-t border-slate-100"
        >
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">
              GovTech member
            </label>
            <select
              name="userId"
              required
              defaultValue={currentUserId && !meAlreadyConnected ? currentUserId : ''}
              className="w-full text-sm border border-slate-200 rounded-md px-2.5 py-1.5"
            >
              <option value="" disabled>
                Pick someone…
              </option>
              {candidates.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                  {u.id === currentUserId ? ' (you)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">
              Strength
            </label>
            <select
              name="strength"
              defaultValue="professional"
              className="w-full text-sm border border-slate-200 rounded-md px-2.5 py-1.5"
            >
              <option value="close">Close — knows them well</option>
              <option value="professional">Professional — worked together</option>
              <option value="acquaintance">Acquaintance — light touch</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">
              Notes <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <textarea
              name="notes"
              rows={2}
              placeholder="e.g. Former colleague at MoF, worked on the 2023 budget."
              className="w-full text-sm border border-slate-200 rounded-md px-2.5 py-1.5 resize-y"
            />
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={pending}
              className="px-3 py-1.5 bg-slate-900 text-white text-sm font-medium rounded-md hover:bg-slate-800 disabled:bg-slate-400"
            >
              {pending ? 'Linking…' : 'Link colleague'}
            </button>
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setError(null);
              }}
              disabled={pending}
              className="px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
