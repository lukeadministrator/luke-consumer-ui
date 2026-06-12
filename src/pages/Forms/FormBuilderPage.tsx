import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { type Schema } from "@coltorapps/builder";
import {
  BuilderEntities,
  BuilderEntityAttributes,
  useBuilderStore,
  useBuilderStoreData,
} from "@coltorapps/builder-react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import PageMeta from "../../components/common/PageMeta";
import Button from "../../components/ui/button/Button";
import { useAuth } from "../../context/AuthContext";
import { canWrite, FORMS } from "../../lib/capabilities";
import Tooltip from "../../components/ui/tooltip/Tooltip";
import { Modal } from "../../components/ui/modal";
import { GripVertical, Sparkles } from "lucide-react";
import { ChevronLeftIcon, CheckLineIcon, PaperPlaneIcon, TrashBinIcon, AngleUpIcon, AngleDownIcon, EyeIcon, PencilIcon } from "../../icons";
import {
  checkIn,
  checkout,
  discardDraft,
  getAudit,
  getForm,
  latestVersion,
  publishVersion,
  release,
  saveDraft,
  updateMeta,
  type AuditEvent,
  type FormStatus,
  type StoredForm,
} from "../../lib/formsApi";
import Label from "../../components/form/Label";
import Input from "../../components/form/input/InputField";
import { formBuilder, PALETTE_GROUPS, CONTAINER_TYPES, type PaletteItem } from "../../components/formBuilder/formBuilder";
import { attributesComponents, entityComponents, BuilderEntitiesContext } from "../../components/formBuilder/components";
import FormRenderer from "../../components/formBuilder/FormRenderer";
import AiAssistPanel from "./AiAssistPanel";
import type { BuilderSchemaLike } from "../../lib/formAgentApi";

type BuilderSchema = Schema<typeof formBuilder>;

function parseSchema(raw: string): BuilderSchema | undefined {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as BuilderSchema;
  } catch {
    return undefined;
  }
}

const GripIcon = GripVertical;

function PaletteButton({ item }: { item: PaletteItem }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette:${item.type}`,
    data: { kind: "palette", item },
  });
  return (
    <button
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      type="button"
      className={`flex cursor-grab items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-left text-sm font-medium text-gray-700 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-600 active:cursor-grabbing dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5 ${isDragging ? "opacity-40" : ""}`}
    >
      <GripIcon className="size-4 text-gray-300" />
      {item.label}
    </button>
  );
}

/** camelCase key from a label, made unique against existing keys. */
function toKey(label: string): string {
  const words = label.replace(/[^a-zA-Z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
  if (!words.length) return "field";
  return words.map((w, i) => (i === 0 ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1).toLowerCase())).join("");
}
function uniqueKey(base: string, existing: Set<string>): string {
  if (!existing.has(base)) return base;
  let n = 2;
  while (existing.has(`${base}${n}`)) n++;
  return `${base}${n}`;
}
// Only these entity types actually define a `key` attribute — injecting `key`
// into any other type makes coltorapps throw "Unknown entity attribute".
const TYPES_WITH_KEY = new Set<string>(
  formBuilder.entities.filter((e) => e.attributes.some((a) => a.name === "key")).map((e) => e.name)
);

function SortableField({ id, isActive, onSelect, onUp, onDown, onDelete, children }: {
  id: string; isActive: boolean; onSelect: () => void; onUp: () => void; onDown: () => void; onDelete: () => void; children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      className={`group relative cursor-pointer rounded-xl border p-4 pl-9 transition ${
        isOver
          ? "border-brand-400 ring-2 ring-brand-300"
          : isActive
            ? "border-brand-400 ring-1 ring-brand-400"
            : "border-gray-200 hover:border-gray-300 dark:border-gray-700"
      }`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        className="absolute left-1.5 top-1/2 -translate-y-1/2 cursor-grab rounded p-1 text-gray-300 hover:text-gray-500 active:cursor-grabbing"
        aria-label="Drag to reorder"
      >
        <GripIcon />
      </button>
      {children}
      <div className="absolute right-2 top-2 flex items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
        <button type="button" onClick={(e) => { e.stopPropagation(); onUp(); }} className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/10" aria-label="Move up"><AngleUpIcon className="size-4" /></button>
        <button type="button" onClick={(e) => { e.stopPropagation(); onDown(); }} className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/10" aria-label="Move down"><AngleDownIcon className="size-4" /></button>
        <button type="button" onClick={(e) => { e.stopPropagation(); onDelete(); }} className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-error-500 dark:hover:bg-white/10" aria-label="Delete field"><TrashBinIcon className="size-4" /></button>
      </div>
    </div>
  );
}

function Canvas({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: "root" });
  return (
    <div ref={setNodeRef} className={`min-h-full space-y-3 rounded-xl transition ${isOver ? "ring-2 ring-brand-300 ring-inset" : ""}`}>
      {children}
    </div>
  );
}

const STATUS_BADGE: Record<FormStatus, string> = {
  draft: "bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400",
  published: "bg-success-50 text-success-600 dark:bg-success-500/15",
  archived: "bg-amber-50 text-amber-600 dark:bg-amber-500/15",
};

function Designer({ tenant, formId, form, reload, onSchema, onOpenAi }: {
  tenant: string; formId: string; form: StoredForm; reload: () => void;
  onSchema?: (s: BuilderSchemaLike) => void; onOpenAi?: () => void;
}) {
  const navigate = useNavigate();
  const { session } = useAuth();
  // read → view-only: the canvas is browsable but nothing is persisted and the
  // write actions are hidden. read-write → full editing.
  const canEdit = canWrite(session, FORMS);
  const me = session?.userId ?? null;
  // Advisory edit-lock: who (if anyone other than me) currently holds it.
  const [lockedByOther, setLockedByOther] = useState<string | null>(
    form.lockedBy && form.lockedBy !== me ? form.lockedBy : null,
  );
  const [activeEntityId, setActiveEntityId] = useState<string | null>(null);
  const [saved, setSaved] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [version, setVersion] = useState(() => latestVersion(form));
  const [publishedVersion, setPublishedVersion] = useState(form.publishedVersion);
  const [status, setStatus] = useState<FormStatus>(form.status);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewSchema, setPreviewSchema] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dragLabel, setDragLabel] = useState<string | null>(null);
  const [formSettingsOpen, setFormSettingsOpen] = useState(false);
  const [formName, setFormName] = useState(form.name);
  const [formDesc, setFormDesc] = useState(form.description ?? "");
  const [paletteQuery, setPaletteQuery] = useState("");
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const saveTimer = useRef<number | null>(null);

  // Load the activity feed when the form-settings modal opens.
  useEffect(() => {
    if (!formSettingsOpen) return;
    let active = true;
    getAudit(tenant, formId)
      .then((a) => active && setAuditEvents(a))
      .catch(() => active && setAuditEvents([]));
    return () => { active = false; };
  }, [formSettingsOpen, tenant, formId]);

  const initialSchema = useMemo(() => parseSchema(form.schema), [form.schema]);

  const builderStore = useBuilderStore(formBuilder, {
    initialData: initialSchema ? { schema: initialSchema } : undefined,
    events: {
      onEntityAttributeUpdated(payload) {
        void builderStore.validateEntityAttribute(payload.entity.id, payload.attributeName);
      },
      onEntityDeleted(payload) {
        if (payload.entity.id === activeEntityId) setActiveEntityId(null);
      },
    },
  });

  const { schema } = useBuilderStoreData(builderStore);
  const order = schema.root;

  // Report the live schema up to the parent so the AI panel (which lives above
  // this remounting component) can read the current form and re-apply changes.
  useEffect(() => {
    onSchema?.(schema as unknown as BuilderSchemaLike);
  }, [schema, onSchema]);

  // Acquire the advisory edit lock on open; release it when leaving. A 409 means
  // someone else holds it — we surface a banner but still allow editing.
  useEffect(() => {
    if (!canEdit) return;
    let active = true;
    checkout(tenant, formId)
      .then(() => active && setLockedByOther(null))
      .catch(() => {}); // 409 → banner already reflects form.lockedBy
    return () => {
      active = false;
      void release(tenant, formId);
    };
  }, [tenant, formId, canEdit]);

  const takeOver = async () => {
    await checkout(tenant, formId, true);
    setLockedByOther(null);
  };

  useEffect(() => {
    if (!canEdit) return; // view-only: never persist edits.
    return builderStore.subscribe((data) => {
      setSaved(false);
      setDirty(true);
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => {
        void saveDraft(tenant, formId, JSON.stringify(data.schema)).then(() => setSaved(true));
      }, 600);
    });
  }, [builderStore, tenant, formId, canEdit]);

  useEffect(() => () => { if (saveTimer.current) window.clearTimeout(saveTimer.current); }, []);

  const flushSave = async () => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    await saveDraft(tenant, formId, JSON.stringify(builderStore.getSchema()));
    setSaved(true);
  };

  const handleCheckIn = async () => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    const artifact = await checkIn(tenant, formId, JSON.stringify(builderStore.getSchema()));
    if (artifact) {
      setVersion(artifact.version);
      if (publishedVersion === undefined) setPublishedVersion(artifact.version);
      setStatus("published");
      setSaved(true);
      setDirty(false);
    }
  };

  const handlePublish = async () => {
    await publishVersion(tenant, formId, version);
    setPublishedVersion(version);
    setStatus("published");
  };

  const handleDiscard = async () => {
    if (!window.confirm("Discard draft changes and revert to the published version?")) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    await discardDraft(tenant, formId);
    reload();
  };

  // Loose view of the schema entities for parent/child resolution.
  const ents = schema.entities as Record<string, { type: string; parentId?: string; children?: string[]; attributes: Record<string, unknown> }>;
  const childrenOf = (id?: string) => (id ? ents[id]?.children ?? [] : order);
  const subtree = (id: string, acc = new Set<string>()): Set<string> => {
    acc.add(id);
    (ents[id]?.children ?? []).forEach((c) => subtree(c, acc));
    return acc;
  };

  const addField = (type: string, defaults: Record<string, unknown>, index?: number, parentId?: string) => {
    const attributes: Record<string, unknown> = { ...defaults };
    if (TYPES_WITH_KEY.has(type)) {
      const existing = new Set<string>();
      for (const eid in ents) {
        const k = ents[eid].attributes.key;
        if (typeof k === "string" && k) existing.add(k);
      }
      attributes.key = uniqueKey(toKey(String(defaults.label ?? type)), existing);
    }
    const entity = builderStore.addEntity({
      type,
      attributes,
      ...(parentId ? { parentId } : {}),
      ...(index !== undefined ? { index } : {}),
    } as Parameters<typeof builderStore.addEntity>[0]);
    // Tabs need at least a couple of tabs to be usable.
    if (type === "tabs") {
      builderStore.addEntity({ type: "tab", attributes: { label: "Tab 1" }, parentId: entity.id } as Parameters<typeof builderStore.addEntity>[0]);
      builderStore.addEntity({ type: "tab", attributes: { label: "Tab 2" }, parentId: entity.id } as Parameters<typeof builderStore.addEntity>[0]);
    }
    // Tables seed cells (numColumns × 2 rows).
    if (type === "table") {
      const cols = typeof defaults.numColumns === "number" ? defaults.numColumns : 2;
      for (let i = 0; i < cols * 2; i++) builderStore.addEntity({ type: "cell", attributes: {}, parentId: entity.id } as Parameters<typeof builderStore.addEntity>[0]);
    }
    setActiveEntityId(entity.id);
  };

  const addTab = (tabsId: string) => {
    const count = ents[tabsId]?.children?.length ?? 0;
    builderStore.addEntity({ type: "tab", attributes: { label: `Tab ${count + 1}` }, parentId: tabsId } as Parameters<typeof builderStore.addEntity>[0]);
  };

  const addTableRow = (tableId: string) => {
    const cols = typeof ents[tableId]?.attributes.numColumns === "number" ? (ents[tableId].attributes.numColumns as number) : 2;
    for (let i = 0; i < cols; i++) builderStore.addEntity({ type: "cell", attributes: {}, parentId: tableId } as Parameters<typeof builderStore.addEntity>[0]);
  };

  const move = (id: string, delta: number) => {
    const siblings = childrenOf(ents[id]?.parentId);
    const idx = siblings.indexOf(id);
    const next = idx + delta;
    if (next < 0 || next >= siblings.length) return;
    builderStore.setEntityIndex(id, next);
  };

  // Resolve where a drop lands: which parent container and at what index.
  const resolveTarget = (overId: string, activeType?: string): { parentId?: string; index: number } => {
    if (overId === "root") return { parentId: undefined, index: order.length };
    const e = ents[overId];
    if (e && CONTAINER_TYPES.has(e.type)) {
      // A field dropped on a Tabs container goes into its first tab, not the tabs shell.
      if (e.type === "tabs" && activeType !== "tab") {
        const firstTab = e.children?.[0];
        if (firstTab) return { parentId: firstTab, index: ents[firstTab]?.children?.length ?? 0 };
      }
      // A field dropped on a Table goes into its first empty cell (or first cell).
      if (e.type === "table" && activeType !== "cell") {
        const cells = e.children ?? [];
        const target = cells.find((c) => (ents[c]?.children?.length ?? 0) === 0) ?? cells[0];
        if (target) return { parentId: target, index: ents[target]?.children?.length ?? 0 };
      }
      return { parentId: overId, index: e.children?.length ?? 0 };
    }
    const parentId = e?.parentId;
    return { parentId, index: Math.max(0, childrenOf(parentId).indexOf(overId)) };
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const onDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current;
    if (data?.kind === "palette") {
      setDragLabel((data.item as PaletteItem).label);
    } else {
      const e = ents[String(event.active.id)];
      const label = e && typeof e.attributes.label === "string" && e.attributes.label ? e.attributes.label : e?.type;
      setDragLabel(label ?? "Field");
    }
  };

  const onDragEnd = (event: DragEndEvent) => {
    setDragLabel(null);
    const { active, over } = event;
    if (!over) return;
    const overId = String(over.id);
    const data = active.data.current;
    const activeType = data?.kind === "palette" ? (data.item as PaletteItem).type : ents[String(active.id)]?.type;
    const target = resolveTarget(overId, activeType);

    if (data?.kind === "palette") {
      const item = data.item as PaletteItem;
      addField(item.type, item.defaults, target.index, target.parentId);
      return;
    }

    const activeId = String(active.id);
    if (activeId === overId) return;
    // Don't drop a container into its own subtree.
    if (target.parentId && subtree(activeId).has(target.parentId)) return;

    const currentParent = ents[activeId]?.parentId;
    if ((target.parentId ?? undefined) === (currentParent ?? undefined)) {
      builderStore.setEntityIndex(activeId, target.index);
    } else if (target.parentId === undefined) {
      builderStore.unsetEntityParent(activeId, { index: target.index });
    } else {
      builderStore.setEntityParent(activeId, target.parentId, { index: target.index });
    }
  };

  const openPreview = () => {
    setPreviewSchema(JSON.stringify(builderStore.getSchema()));
    setPreviewOpen(true);
  };

  const saveFormSettings = async () => {
    const name = formName.trim() || form.name;
    setFormName(name);
    await updateMeta(tenant, formId, { name, description: formDesc });
    setFormSettingsOpen(false);
  };

  return (
    <>
      <PageMeta title={`${form.name} | Lukeflow`} description="Design your form in Lukeflow." />

      {canEdit && lockedByOther && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-400">
          <span>
            This form is being edited by <span className="font-medium">{lockedByOther.replace(/^workos:/, "")}</span>. Your changes may overwrite theirs.
          </span>
          <Button size="sm" variant="outline" onClick={takeOver}>Take over</Button>
        </div>
      )}

      {/* Toolbar */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Tooltip content="Back to form list">
          <button type="button" onClick={() => navigate("/forms")} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-medium text-gray-600 transition hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-white/5">
            <ChevronLeftIcon className="size-5" />Forms
          </button>
        </Tooltip>
        <div className="h-6 w-px bg-gray-200 dark:bg-gray-700" />
        <div className="min-w-0">
          <button type="button" onClick={() => setFormSettingsOpen(true)} className="group flex max-w-full items-center gap-1.5 text-base font-semibold text-gray-800 dark:text-white/90">
            <span className="truncate">{formName}</span>
            <PencilIcon className="size-3.5 shrink-0 text-gray-300 transition group-hover:text-gray-500" />
          </button>
          <p className="flex items-center gap-1.5 text-[11px] leading-tight text-gray-400">
            <span className="font-mono">{form.code}</span>
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase ${STATUS_BADGE[status]}`}>{status}</span>
            <span>{publishedVersion ? `v${publishedVersion} live` : version ? `v${version} checked in` : "never checked in"}</span>
            {dirty && (<><span className="size-1 rounded-full bg-amber-400" /><span className="text-amber-500">unchecked-in changes</span></>)}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {!canEdit ? (
            <>
              <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-500 dark:bg-white/10 dark:text-gray-400">
                View only
              </span>
              <Tooltip content="Preview & test the form — conditions, calculations and validation run live."><Button size="sm" variant="outline" onClick={openPreview} startIcon={<EyeIcon className="size-4" />}>Preview</Button></Tooltip>
            </>
          ) : (
            <>
              <Tooltip content="Build or edit this form by chatting with AI">
                <Button size="sm" variant="outline" onClick={onOpenAi} startIcon={<Sparkles className="size-4" />}>AI</Button>
              </Tooltip>
              <span className="mr-1 hidden text-xs text-gray-400 sm:inline">{saved ? "Draft saved" : "Saving…"}</span>
              {dirty && version > 0 && (
                <Tooltip content="Discard draft edits and revert to the live version."><Button size="sm" variant="outline" onClick={handleDiscard}>Discard</Button></Tooltip>
              )}
              <Tooltip content="Preview & test the form — conditions, calculations and validation run live."><Button size="sm" variant="outline" onClick={openPreview} startIcon={<EyeIcon className="size-4" />}>Preview</Button></Tooltip>
              <Tooltip content="Save your progress as a draft. Drafts keep your edits so you can continue working, but can't be used in workflows yet."><Button size="sm" variant="outline" onClick={flushSave} startIcon={<CheckLineIcon className="size-4" />}>Save</Button></Tooltip>
              <Tooltip content="Check in a version as an artifact that workflows can use. Your draft stays editable for further changes."><Button size="sm" variant="outline" onClick={handleCheckIn} startIcon={<PaperPlaneIcon className="size-4" />}>Check in</Button></Tooltip>
              {version > 0 && (
                <Tooltip content="Make the latest checked-in version the live one that workflows use."><Button size="sm" onClick={handlePublish} disabled={publishedVersion === version}>{publishedVersion === version ? "Published" : `Publish v${version}`}</Button></Tooltip>
              )}
            </>
          )}
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragLabel(null)}>
        <div className={`grid h-[calc(100vh-200px)] min-h-[520px] grid-cols-1 gap-4 ${canEdit ? "lg:grid-cols-[220px_1fr]" : ""}`}>
          {/* Palette — only when the user can edit. */}
          {canEdit && (
          <div className="overflow-y-auto rounded-2xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-white/[0.03]">
            <input
              type="search"
              value={paletteQuery}
              onChange={(e) => setPaletteQuery(e.target.value)}
              placeholder="Search fields…"
              className="mb-3 h-9 w-full rounded-lg border border-gray-200 bg-transparent px-3 text-sm text-gray-800 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/20 dark:border-gray-700 dark:text-white/90"
            />
            {(() => {
              const q = paletteQuery.trim().toLowerCase();
              const groups = q
                ? PALETTE_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => i.label.toLowerCase().includes(q) || i.type.toLowerCase().includes(q)) })).filter((g) => g.items.length)
                : PALETTE_GROUPS;
              if (groups.length === 0) return <p className="px-1 py-4 text-center text-xs text-gray-400">No fields match “{paletteQuery}”.</p>;
              return groups.map((group) => (
                <div key={group.group} className="mb-4 last:mb-0">
                  <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-gray-400">{group.group}</p>
                  <div className="flex flex-col gap-1.5">
                    {group.items.map((item) => (
                      <PaletteButton key={item.type} item={item} />
                    ))}
                  </div>
                </div>
              ));
            })()}
          </div>
          )}

          {/* Canvas — non-interactive when the user only has read access. */}
          <div className="overflow-y-auto rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
            <div className={canEdit ? "" : "pointer-events-none select-none"}>
            <Canvas>
              {order.length === 0 ? (
                <div className="flex h-full min-h-[400px] flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 py-16 text-center dark:border-gray-700">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">No fields yet</p>
                  <p className="mt-1 text-sm text-gray-400">{canEdit ? "Drag a field from the left to start building." : "This form has no fields."}</p>
                </div>
              ) : (
                <SortableContext items={Object.keys(schema.entities)} strategy={verticalListSortingStrategy}>
                  <BuilderEntitiesContext.Provider value={ents}>
                    <BuilderEntities builderStore={builderStore} components={entityComponents}>
                      {(props) => (
                        <SortableField
                          id={props.entity.id}
                          isActive={props.entity.id === activeEntityId}
                          onSelect={() => { setActiveEntityId(props.entity.id); setSettingsOpen(true); }}
                          onUp={() => move(props.entity.id, -1)}
                          onDown={() => move(props.entity.id, 1)}
                          onDelete={() => builderStore.deleteEntity(props.entity.id)}
                        >
                          {props.children}
                        </SortableField>
                      )}
                    </BuilderEntities>
                  </BuilderEntitiesContext.Provider>
                </SortableContext>
              )}
            </Canvas>
            </div>
          </div>
        </div>

        <DragOverlay dropAnimation={null}>
          {dragLabel ? (
            <div className="flex cursor-grabbing items-center gap-2 rounded-lg border border-brand-300 bg-white px-3 py-2 text-sm font-medium text-brand-600 shadow-theme-lg dark:bg-gray-900">
              <GripIcon className="size-4 text-brand-300" />
              {dragLabel}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <Modal isOpen={formSettingsOpen} onClose={() => setFormSettingsOpen(false)} className="mx-4 w-full max-w-[480px]">
        <div className="p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white/90">Form settings</h2>
          <div className="mb-4 rounded-lg bg-gray-50 px-3 py-2 dark:bg-white/5">
            <span className="text-xs text-gray-400">Form ID</span>
            <p className="font-mono text-sm font-medium text-gray-700 dark:text-gray-200">{form.code}</p>
          </div>
          <div className="mb-4">
            <Label>Form name</Label>
            <Input value={formName} onChange={(e) => setFormName(e.target.value)} disabled={!canEdit} />
          </div>
          <div className="mb-6">
            <Label>Description</Label>
            <Input value={formDesc} onChange={(e) => setFormDesc(e.target.value)} placeholder="Optional" disabled={!canEdit} />
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setFormSettingsOpen(false)}>{canEdit ? "Cancel" : "Close"}</Button>
            {canEdit && <Button onClick={saveFormSettings} disabled={!formName.trim()}>Save</Button>}
          </div>

          {auditEvents.length > 0 && (
            <div className="mt-6 border-t border-gray-100 pt-4 dark:border-gray-800">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Activity</p>
              <ul className="max-h-40 space-y-1 overflow-y-auto">
                {auditEvents.map((ev, i) => (
                  <li key={i} className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span><span className="font-medium text-gray-700 dark:text-gray-300">{ev.action.replace(/_/g, " ")}</span>{ev.detail ? ` ${ev.detail}` : ""}</span>
                    <span className="text-gray-400">{new Date(ev.at).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Modal>

      <Modal isOpen={settingsOpen && !!activeEntityId} onClose={() => setSettingsOpen(false)} className="mx-4 max-h-[85vh] w-full max-w-[520px] overflow-y-auto">
        <div className="p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white/90">Field settings</h2>
          {activeEntityId ? (
            <BuilderEntityAttributes builderStore={builderStore} components={attributesComponents} entityId={activeEntityId} />
          ) : null}
          {activeEntityId && ents[activeEntityId]?.type === "tabs" ? (
            <button
              type="button"
              onClick={() => addTab(activeEntityId)}
              className="mt-2 rounded-lg border border-brand-300 px-3 py-2 text-sm font-medium text-brand-600 hover:bg-brand-50 dark:hover:bg-white/5"
            >
              + Add tab
            </button>
          ) : null}
          {activeEntityId && ents[activeEntityId]?.type === "table" ? (
            <button
              type="button"
              onClick={() => addTableRow(activeEntityId)}
              className="mt-2 rounded-lg border border-brand-300 px-3 py-2 text-sm font-medium text-brand-600 hover:bg-brand-50 dark:hover:bg-white/5"
            >
              + Add row
            </button>
          ) : null}
        </div>
      </Modal>

      <Modal isOpen={previewOpen} onClose={() => setPreviewOpen(false)} className="mx-4 max-h-[90vh] w-full max-w-[640px] overflow-y-auto">
        <div className="p-6 sm:p-8">
          <h2 className="mb-1 text-lg font-semibold text-gray-800 dark:text-white/90">Preview — {form.name}</h2>
          <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">Fill it out to test conditions, calculated values and validation.</p>
          <FormRenderer schema={previewSchema} />
        </div>
      </Modal>
    </>
  );
}

export default function FormBuilderPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { session, refreshSession } = useAuth();
  const tenant = session?.tenant ?? null;
  const [reloadKey, setReloadKey] = useState(0);
  const [form, setForm] = useState<StoredForm | null>(null);
  const [loading, setLoading] = useState(true);
  // AI panel state lives here (above the keyed Designer) so chat history and the
  // panel survive the builder remount that applying a change triggers.
  const [aiOpen, setAiOpen] = useState(false);
  const [liveSchema, setLiveSchema] = useState<BuilderSchemaLike | null>(null);

  // Re-read the session on entry so the editor reflects the caller's *current*
  // FORMS access (a role change made elsewhere won't be in the bootstrap session).
  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  useEffect(() => {
    if (!tenant || !id) return;
    let active = true;
    setLoading(true);
    getForm(tenant, id)
      .then((f) => { if (active) { setForm(f); setLoading(false); } })
      .catch(() => { if (active) { setLoading(false); navigate("/forms", { replace: true }); } });
    return () => { active = false; };
  }, [tenant, id, reloadKey, navigate]);

  if (loading) {
    return <div className="flex h-[60vh] items-center justify-center text-sm text-gray-400">Loading form…</div>;
  }
  if (!tenant || !id || !form) return null;

  return (
    <>
      <Designer
        key={`${form.id}-${reloadKey}`}
        tenant={tenant}
        formId={id}
        form={form}
        reload={() => setReloadKey((k) => k + 1)}
        onSchema={setLiveSchema}
        onOpenAi={() => setAiOpen(true)}
      />
      <AiAssistPanel
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        tenant={tenant}
        formId={id}
        formName={form.name}
        schema={liveSchema}
        onApplied={() => setReloadKey((k) => k + 1)}
      />
    </>
  );
}
