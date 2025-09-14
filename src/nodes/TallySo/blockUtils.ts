import type { IDataObject } from 'n8n-workflow';

// Lightweight types (loose to pass-through unknown fields)
export interface TallyBlock {
  uuid: string;
  type?: string;
  label?: string;
  groupUuid?: string;
  groupType?: string;
  payload?: Record<string, any>;
  [key: string]: any;
}

export interface TallyForm {
  id: string;
  name?: string;
  settings?: Record<string, any>;
  blocks: TallyBlock[];
  updatedAt?: string;
  [key: string]: any;
}

export interface TallySelectOption {
  label: string;
  value: string;
  [key: string]: any;
}

export function generateUuid(): string {
  // RFC4122 v4 simple implementation
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function cloneForm(form: TallyForm): TallyForm {
  return JSON.parse(JSON.stringify(form));
}

export function cloneBlocks(blocks: TallyBlock[]): TallyBlock[] {
  return JSON.parse(JSON.stringify(blocks));
}

export function findBlockByUuid(blocks: TallyBlock[], uuid: string): { index: number; block?: TallyBlock } {
  const index = blocks.findIndex((b) => b.uuid === uuid);
  return { index, block: index >= 0 ? blocks[index] : undefined };
}

export function replaceBlock(blocks: TallyBlock[], uuid: string, newBlock: TallyBlock): TallyBlock[] {
  const next = cloneBlocks(blocks);
  const { index } = findBlockByUuid(next, uuid);
  if (index >= 0) {
    next[index] = newBlock;
  }
  return next;
}

export type InsertPosition =
  | { mode: 'index'; index: number }
  | { mode: 'before' | 'after'; refUuid: string };

export function insertBlock(blocks: TallyBlock[], block: TallyBlock, position?: InsertPosition): TallyBlock[] {
  const next = cloneBlocks(blocks);
  if (!position) {
    next.push(block);
    return next;
  }
  if (position.mode === 'index') {
    const idx = Math.max(0, Math.min(position.index, next.length));
    next.splice(idx, 0, block);
    return next;
  }
  const { index: refIndex } = findBlockByUuid(next, position.refUuid);
  if (refIndex < 0) {
    next.push(block);
    return next;
  }
  const insertIdx = position.mode === 'before' ? refIndex : refIndex + 1;
  next.splice(insertIdx, 0, block);
  return next;
}

export function removeBlocks(blocks: TallyBlock[], uuids: string[]): TallyBlock[] {
  const set = new Set(uuids);
  return blocks.filter((b) => !set.has(b.uuid));
}

export function ensureUniqueUuids(blocks: TallyBlock[]): TallyBlock[] {
  const seen = new Set<string>();
  return blocks.map((b) => {
    const copy = { ...b } as TallyBlock;
    if (seen.has(copy.uuid)) copy.uuid = generateUuid();
    seen.add(copy.uuid);
    return copy;
  });
}

export function newBlockTemplate(type: string, label: string, payload?: IDataObject): TallyBlock {
  const uuid = generateUuid();
  const groupUuid = generateUuid(); // Each block needs a unique groupUuid
  
  // Default payload structure based on field type
  let defaultPayload = payload || {};
  
  // Add required fields for input types that need them
  if (['INPUT_TEXT', 'INPUT_EMAIL', 'TEXTAREA', 'INPUT_PHONE', 'INPUT_URL'].includes(type)) {
    defaultPayload = {
      isRequired: false,
      placeholder: '',
      ...defaultPayload,
    };
  }

  return {
    uuid,
    type,
    label,
    groupUuid,
    groupType: type, // Most types use the same value for groupType
    payload: Object.keys(defaultPayload).length > 0 ? defaultPayload : undefined,
  };
}

export function newTitleBlock(title: string): TallyBlock {
  const titleBlock = newBlockTemplate('TITLE', '', {
    safeHTMLSchema: [[title]]
  });
  // Title blocks use groupType 'QUESTION'
  titleBlock.groupType = 'QUESTION';
  return titleBlock;
}

export function updateSelectOptions(
  block: TallyBlock,
  options: TallySelectOption[],
  preserveExtras = false,
): TallyBlock {
  const next = JSON.parse(JSON.stringify(block)) as TallyBlock;
  const existing = Array.isArray(next.payload?.options) ? (next.payload!.options as TallySelectOption[]) : [];
  if (preserveExtras) {
    // Merge by value; replace labels for matching values; append new ones
    const byValue = new Map(existing.map((o) => [o.value, o] as const));
    for (const o of options) {
      if (byValue.has(o.value)) {
        byValue.get(o.value)!.label = o.label;
      } else {
        byValue.set(o.value, { ...o });
      }
    }
    next.payload = {
      ...(next.payload || {}),
      options: Array.from(byValue.values()),
    };
  } else {
    next.payload = {
      ...(next.payload || {}),
      options: options.map((o) => ({ ...o })),
    };
  }
  return next;
}

export function stripOrRegenUuid(block: TallyBlock, regen = true): TallyBlock {
  const next = JSON.parse(JSON.stringify(block)) as TallyBlock;
  if (regen) next.uuid = generateUuid();
  return next;
}

export function findBlockByLabel(questions: any[], label: string): { blockUuid?: string; question?: any } {
  const q = questions.find((q) => (q.label || q.title || '').trim() === label.trim());
  return { blockUuid: q?.blockUuid || q?.id || q?.uuid, question: q };
}
