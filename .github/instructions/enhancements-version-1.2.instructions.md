---
applyTo: '**'
---
# .github/agent-instructions.md — Copilot Agent for `n8n-nodes-tally`

> **Purpose**: Guide Copilot to implement safe, user-friendly Tally.so field operations in the `n8n-nodes-tally` community node.
>
> **Hard requirements**: Node **>= 20.19** and **pnpm**.

---

> **Task tracking**: All actionable items below are prefixed with `[ ]`. The agent **MUST** check items off to `[x]` in this file as they are completed.

## 0) Context & Goals

**Repo**: `brianmoney/n8n-nodes-tally`

**Current**: Node supports basic **Form** (`getAll`, `get`) and **Submission** (`getAll`) operations only.

**Goals**:

* [x] Add safe, high-level field operations that *abstract away* raw JSON editing.
* [x] Enable Airtable → Tally **select options sync**.
* [x] Enable **copying questions** (fields) from Form A → Form B.
* [x] Keep users safe from form data loss when using Tally **PATCH /forms/{formId}**.

**Key constraint**: Tally **PATCH** overwrites the target fields in `blocks`. Our node must always **fetch → modify → patch full `blocks`** to avoid destructive updates.

---

## 1) Design Principles (Copilot: follow exactly)

* **Safety first**

  * [x] Always **GET full form** before any mutation.
  * [x] Mutate an **in-memory clone** of `blocks` and **PATCH** the **full, merged** array.
  * [x] Provide **Dry‑Run/Preview**, **Automatic Backup (pre‑patch JSON)**, and **Optimistic Concurrency** (compare `updatedAt`).
* **Ergonomic UX**

  * [x] Task-level operations: *Add Field*, *Update Field*, *Delete Field*, *Sync Select Options*, *List Questions*, *Copy Questions*.
  * [x] Let users pick field **by UUID** or **by label** (resolve labels via Questions endpoint).
* **Minimal surface area**

  * [x] Extend existing helper (`makeTallyRequest.ts`) to support `PATCH`.
  * [x] Keep Tally block shape **loosely typed**; don’t block unknown fields.
* **Recoverability**

  * [x] Output **pre‑patch form JSON** for rollback.
  * [x] Add a simple *Rollback Form* operation (optional, low effort).

---

## 2) New/Enhanced Operations

> All under resource **Form**, unless noted.

### A) **List Questions**

* **Purpose**: Populate question selectors and enable field-level edits.
* **Inputs**: `formId`.
* **Action**: `GET /forms/{formId}/questions` → return array of question metadata (incl. `blockUuid`, label, type).

### B) **Add Field**

* **Inputs**: `formId`, `type`, `label`, `placeholder?` (for input types), `optionsJson?` (for option-based types), `position` (end/index/before/after), optional `payload` (type-specific; disabled for option types).
* **Flow**: GET form → create block(s) → splice into `blocks` → PATCH full form.
* **Notes**:
  * For option-based types (Dropdown/Multiple Choice/Checkboxes/Multi-select), the node creates one block per option from `optionsJson`; `payload` is hidden/ignored for these types.
  * For input types (TEXT/EMAIL/LINK/PHONE/NUMBER/DATE/TIME/TEXTAREA), `placeholder` is merged into payload; if empty, the node falls back to `label` for placeholder.
* **Output**: updated form (or the new block(s)) + backup of prior form JSON.

### C) **Update Field**

* **Inputs**: `formId`, `targetField` (UUID or label), `payloadPatch` (type-specific), `mergeStrategy` (merge/replace), flags: `dryRun`, `backup`, `optimistic`.
* **Flow**: GET form & questions → locate block → apply patch (merge or replace parts like `payload.options`) → optionally preview diff → PATCH.

### D) **Delete Field**

* **Inputs**: `formId`, `targetField(s)` (UUIDs or labels), `failIfRequired?`.
* **Flow**: GET form → remove blocks → PATCH.

### E) **Sync Select Options**

* **Inputs**: `formId`, `targetField` (Select), `optionsSource` (incoming items mapping to `{label, value}`), `preserveExtras?` (bool), flags: `dryRun`, `backup`, `optimistic`.
* **Flow**: GET form & questions → build options array from input data → set/merge into `payload.options` → PATCH.

### F) **Copy Questions (Form A → Form B)**

* **Inputs**: `sourceFormId`, `destFormId`, `questionIds` (from source), `insertPosition`.
* **Flow**: GET both forms + `questions` on source → extract source blocks → **strip/regen UUIDs** → splice into dest `blocks` → PATCH dest.
* **Warn**: complex logic/payment/group dependencies may not port 1:1; surface API errors.

### (Optional) G) **Rollback Form**

* **Inputs**: `formId`, `backupFormJson` (from a previous node output).
* **Flow**: PATCH full backup JSON.

---

## 3) Node UI/UX Notes (n8n `properties`)

* [x] Add **big warning** to all write ops: *“This rewrites form `blocks`. We fetch and merge for you, but anything not included may be removed. Use Dry‑Run and Backup.”*
* [x] **Field Selector**: radio → *By UUID* / *By Label*. If *By Label*, node calls **List Questions** to resolve.
* [x] **Dry‑Run/Preview**: boolean. If true → output proposed `blocks` + a field‑level diff; skip PATCH.
* [x] **Backup**: default ON. Output `previousForm` (full JSON) in `binary` or `json` for rollback.
* [x] **Optimistic Concurrency**: when enabled, compare `updatedAt` from initial GET vs a fast GET before PATCH; abort if changed.

Additional UX in v1.2

* [x] Add Field: `Options (JSON)` input for option-based types (Dropdown/Multiple Choice/Checkboxes/Multi-select); the node generates one option block per item and hides `Payload (JSON)` to avoid confusion.
* [x] Add Field: `Placeholder` input for input types (Short/Long Text, Email, URL, Phone, Number, Date, Time). If left empty, `label` is used as placeholder.
* [x] Remove non-mapped UI types (e.g., Yes/No). Use Multiple Choice with two options or a single Checkbox instead.

---

## 4) Data & Helpers

* [x] **Types**: define lightweight interfaces (`TallyForm`, `TallyBlock`, `TallySelectOption`) with index signatures to allow pass‑through fields.
* [x] **ID utils**: `generateUuid()`, `findBlockByUuid()`, `findBlockByLabel(questions, label)`.
* [x] **Diff**: shallow diff for `payload` (and optionally options list) to power Dry‑Run summary.
* [x] **HTTP**: extend `tallyApiRequest()` to accept `PATCH` and generic body; keep headers & base URL.

---

## 5) File-by-File Tasks (Copilot: create/modify exactly)

* [x] `nodes/TallySo/TallySo.node.ts`

  * [x] Add `operations`: `listQuestions`, `addField`, `updateField`, `deleteField`, `syncSelectOptions`, `copyQuestions`, *(optional)* `rollbackForm`.
  * [x] Add inputs for each operation (resource: `form`).
  * [x] Implement `execute()` branches for each op using helpers below.
  * [x] Add `methods.loadOptions.getForms` (already exists) + `getQuestions(formId)` for question dropdowns.

* [x] `nodes/TallySo/makeTallyRequest.ts`

  * [x] Allow `PATCH` type; export convenience wrappers: `getForm(formId)`, `listQuestions(formId)`, `updateForm(formId, body)`.

* [x] `nodes/TallySo/blockUtils.ts` *(new)*

  * [x] `cloneForm(form)`, `replaceBlock(blocks, uuid, newBlock)`, `insertBlock(blocks, block, position)`, `removeBlocks(blocks, uuids)`, `updateSelectOptions(block, options, preserveExtras)`.
  * [x] `ensureUniqueUuids(blocks)`; `newBlockTemplate(type, label, payload)`.

* [x] `nodes/TallySo/diff.ts` *(new)*

  * [x] `diffBlocks(before, after)` → summarize changes per `blockUuid` (added/updated/removed, options delta counts).

* [x] `README.md`

  * [x] Document new operations, warnings, examples, and sample workflows.

* [x] `package.json`

  * [x] Ensure scripts use **pnpm** (`pnpm lint`, `pnpm build`, `pnpm dev`).

---

## 6) Operation Pseudocode (Copilot scaffolds)

**Common pattern**

```ts
const formId = getNodeParameter('formId', 0) as string;
const dryRun = getNodeParameter('dryRun', 0, false) as boolean;
const backup = getNodeParameter('backup', 0, true) as boolean;
const optimistic = getNodeParameter('optimistic', 0, true) as boolean;

const before = await getForm(formId); // full form (incl. blocks, updatedAt)
let blocks = clone(before.blocks);

// … mutate blocks …

if (dryRun) {
  return [{ json: { preview: true, diff: diffBlocks(before.blocks, blocks), proposedBlocks: blocks, formId } }];
}

if (optimistic) {
  const latest = await getForm(formId);
  if (latest.updatedAt !== before.updatedAt) {
    throw new NodeOperationError(this.getNode(), 'Form changed since read. Re-run to avoid conflicts.');
  }
}

const resp = await updateForm(formId, { blocks, settings: before.settings, name: before.name });
return [{ json: { updated: true, form: resp, backup: backup ? before : undefined } }];
```

**Sync Select Options**

```ts
const questionRef = getNodeParameter('targetField', 0) as string; // uuid or label
const preserve = getNodeParameter('preserveExtras', 0, false) as boolean;
const srcItems = this.getInputData();
const options = srcItems.map(({ json }) => ({ label: json.label, value: json.value }));

const qUuid = resolveUuidBySelector(questionRef, await listQuestions(formId));
const idx = findIndexByUuid(blocks, qUuid);
blocks[idx] = updateSelectOptions(blocks[idx], options, preserve);
```

**Copy Questions**

```ts
const sourceFormId = getNodeParameter('sourceFormId', 0) as string;
const destFormId = getNodeParameter('destFormId', 0) as string;
const qIds = getNodeParameter('questionIds', 0) as string[];

const sourceForm = await getForm(sourceFormId);
const destForm = await getForm(destFormId);

const toCopy = sourceForm.blocks.filter(b => qIds.includes(b.uuid)).map(stripOrRegenUuid);
const newBlocks = spliceAt(destForm.blocks, toCopy, insertPosition);
await updateForm(destFormId, { ...destForm, blocks: newBlocks });
```

---

## 7) Acceptance Criteria

* [x] **List Questions** returns question metadata incl. block UUIDs and labels.
* [x] **Add/Update/Delete/Sync**: execute without requiring users to paste full form JSON.
* [x] **PATCH safety**: node always fetches latest, merges, and patches full `blocks`.
* [x] **Warnings**: UI copy present on all write ops; Dry‑Run + Backup flags available; Optimistic mode works.
* [x] **Copy Questions**: copied fields appear in dest form; UUIDs are unique; position respected.
* [x] **Docs**: README updated with examples and cautions.
* [x] **Lint**: `eslint-plugin-n8n-nodes-base` passes.

---

## 8) Example Workflows (docs snippets)

* **Airtable → Tally Select Sync**

  * Airtable Trigger → Airtable List → Map to `{label, value}` → Tally **Sync Select Options** (Dry‑Run first) → Tally **Sync Select Options** (commit).

* **Copy Fields Between Forms**

  * Tally **List Questions** (source) → Select IDs → Tally **Copy Questions** → Tally **List Questions** (dest) to verify.

---

## 9) Dev Setup & Commands

* [ ] Install: `pnpm i`
* [ ] Dev watch: `pnpm dev`
* [x] Build: `pnpm build`
* [x] Lint: `pnpm lint`
* [ ] Node engine: **>= 20.19**

*(If migrating to `@n8n/node-cli`, ensure parity: build, watch, publish workflows; but not required for these features.)*

---

## 10) Error Handling & Rate Limits

* [ ] Respect Tally API limits (100 req/min). Batch and debounce where reasonable.
* [ ] On HTTP 4xx/5xx, emit descriptive `NodeOperationError` with endpoint and brief remediation hint.
* [ ] On optimistic conflict, abort with clear message and instructions to re-run.

---

## 11) Copilot Prompts (quick recipes)

* *“Add a `PATCH` branch in `makeTallyRequest.ts` compatible with `IExecuteFunctions | ILoadOptionsFunctions | IHookFunctions`.”*
* *“Create `blockUtils.ts` with helpers to insert, replace, remove, and update select options without mutating original arrays.”*
* *“In `TallySo.node.ts`, add a **Form → Sync Select Options** operation with inputs: `formId`, `targetField` (UUID/label), `preserveExtras`, flags (`dryRun`, `backup`, `optimistic`). Implement fetch‑merge‑patch flow.”*
* *“Implement **Copy Questions** operation handling UUID regeneration and position insertion.”*
* *“Add a `diff.ts` helper that returns added/removed/changed blocks and counts of option deltas.”*
* *“Update README with new operations, warnings, and two example workflows.”*

---

## 12) Documentation Copy (include in README)

* **Warning**: *Updating a form uses Tally’s PATCH and rewrites the form’s `blocks`. This node always fetches, merges and patches the full array to avoid destructive edits. Use Dry‑Run/Preview and Backup before committing.*
* **Optimistic Concurrency**: Prevents hidden overwrites if the form changed mid‑execution.
* **Rollback**: Save the `previousForm` JSON output and use **Rollback Form** to restore.

---

## 13) Release Plan

* [ ] Branch: `feat/tally-field-ops`
* [ ] Version: `minor` bump (new features, backward compatible).
* [ ] PR checklist: Lint clean, README updated, sample workflows exported, tested with a real form.

---

## 14) Future Enhancements (parking lot)

* Support for grouped blocks / conditional logic cloning.
* Webhook trigger convenience wrapper for submissions.
* Auto‑paginate submissions and questions when Tally adds pagination.

---

## Agent Progress Notes — 2025‑09‑14

Context: Work is happening on branch `feat/tally-field-ops`. Build and lint pass via `@n8n/node-cli` (pnpm). Major features in this iteration are implemented and verified locally.

What’s implemented
- New form operations: List Questions, Add Field, Update Field, Delete Field, Sync Select Options, Copy Questions, and Rollback Form.
- Safety pattern: always GET → clone/mutate → PATCH full `blocks`; supports Dry‑Run preview, automatic Backup output, and Optimistic Concurrency (compares `updatedAt`).
- Title support: providing a Title creates a separate `TITLE` block before the field; `groupType` for TITLE is `QUESTION`.
- Type mapping and payloads: input types use `INPUT_*` variants (TEXT/EMAIL/LINK/PHONE/NUMBER/DATE/TIME/TEXTAREA) with `payload.isRequired` and `placeholder` support; placeholder falls back to the Label when not set.
- Option-based types (Dropdown/Multiple Choice/Checkboxes/Multi-select) are created via `Options (JSON)` as per-option blocks (correct type/groupType); `Payload (JSON)` is hidden for these types to avoid confusion.
- URL mapping: `URL` uses `INPUT_LINK`. No fallback logic required.
- Removed the "Template from existing field" UI and logic.
- Removed non-mapped Yes/No type from the UI.

Known quirks and tips
- Tally requires both `uuid` and a distinct `groupUuid` per block; `groupType` usually matches `type` except for `TITLE` which uses `QUESTION`.
- PATCH replaces the entire `blocks` array; never send partial arrays. Always include existing `settings` and `name` fields when patching.
- Option-based fields are modeled as per-option blocks with a shared `groupUuid` and the correct `groupType`.

Verification checklist
- Build: `pnpm build` → PASS; Lint: `pnpm lint` → PASS.
- Dry‑Run shows a `diffBlocks` summary and proposedBlocks; turning Dry‑Run off commits via PATCH.
- After any write op with Optimistic Concurrency ON, the node aborts if `updatedAt` changed.

Next small steps
- Broader field type smoke tests (PHONE, NUMBER, DATE/TIME, RATING, FILE_UPLOAD) to catch schema edge cases.
- Add more README examples for Update/Delete and Copy Questions.
