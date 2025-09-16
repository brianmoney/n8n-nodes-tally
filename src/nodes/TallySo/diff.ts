import type { TallyBlock } from './blockUtils';

export interface BlockChange {
  uuid: string;
  type?: string;
  label?: string;
  change: 'added' | 'removed' | 'updated';
  details?: Record<string, any>;
}

function shallowEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  const ak = Object.keys(a);
  const bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  for (const k of ak) {
    if (a[k] !== b[k]) return false;
  }
  return true;
}

function optionsDelta(before?: any[], after?: any[]) {
  const b = Array.isArray(before) ? before : [];
  const a = Array.isArray(after) ? after : [];
  const beforeVals = new Set(b.map((o: any) => o.value));
  const afterVals = new Set(a.map((o: any) => o.value));
  let added = 0;
  let removed = 0;
  for (const v of afterVals) if (!beforeVals.has(v)) added++;
  for (const v of beforeVals) if (!afterVals.has(v)) removed++;
  return { added, removed, beforeCount: b.length, afterCount: a.length };
}

export function diffBlocks(before: TallyBlock[], after: TallyBlock[]): BlockChange[] {
  const changes: BlockChange[] = [];
  const beforeMap = new Map(before.map((b) => [b.uuid, b] as const));
  const afterMap = new Map(after.map((b) => [b.uuid, b] as const));

  // Added and updated
  for (const [uuid, a] of afterMap.entries()) {
    const b = beforeMap.get(uuid);
    if (!b) {
  const details: Record<string, any> | undefined = a.payload ? { payload: true } : undefined;
  changes.push({ uuid, type: a.type, label: a.label, change: 'added', details });
      continue;
    }
    const payloadChanged = !shallowEqual(b.payload || {}, a.payload || {});
    const metaChanged = b.type !== a.type || b.label !== a.label;
    if (payloadChanged || metaChanged) {
      const details: Record<string, any> = {};
      if (payloadChanged) {
        details.payload = true;
        if (Array.isArray((b.payload || {}).options) || Array.isArray((a.payload || {}).options)) {
          details.optionsDelta = optionsDelta((b.payload || {}).options, (a.payload || {}).options);
        }
      }
      if (metaChanged) details.meta = true;
      changes.push({ uuid, type: a.type, label: a.label, change: 'updated', details });
    }
  }

  // Removed
  for (const [uuid, b] of beforeMap.entries()) {
    if (!afterMap.has(uuid)) {
      changes.push({ uuid, type: b.type, label: b.label, change: 'removed' });
    }
  }

  return changes;
}
