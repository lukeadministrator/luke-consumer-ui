import { useEffect, useMemo, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  evaluateCondition,
  evaluateExpression,
  evaluateValidation,
  type Scope,
} from "../../lib/expression";
import { repairSchema, type FormSchema } from "../../lib/formSchema";
import DOMPurify from "dompurify";
import { Modal } from "../ui/modal";
import FieldTooltip from "./FieldTooltip";

type Attrs = Record<string, unknown>;
type SchemaEntity = { type: string; attributes: Attrs };
type ParsedSchema = { entities: Record<string, SchemaEntity>; root: string[] };

// Accessibility wiring threaded from a field's wrapper down to its control, so
// label, error and description are programmatically associated with the input.
type FieldA11y = {
  id: string;
  labelId: string;
  describedBy?: string;
  invalid: boolean;
  required: boolean;
};
// Control types that are NOT a single labelable element — their label uses
// aria-labelledby instead of htmlFor, and they render as an ARIA group.
const NON_LABELABLE = new Set(["radio", "selectBoxes", "day", "signature"]);

const asStr = (v: unknown) => (typeof v === "string" ? v : "");
const asBool = (v: unknown) => Boolean(v);
const asArr = (v: unknown) => (Array.isArray(v) ? (v as string[]) : []);
const asNum = (v: unknown) => (typeof v === "number" ? v : undefined);

type Opt = { label: string; value: string };
const normOptions = (v: unknown): Opt[] =>
  (Array.isArray(v) ? v : []).map((o) =>
    typeof o === "string" ? { label: o, value: o } : { label: String((o as Opt)?.label ?? ""), value: String((o as Opt)?.value ?? "") }
  );

const inputClass =
  "h-11 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/20 dark:border-gray-700 dark:text-white/90";

type StoredFile = { name: string; url: string };

// File input. With no backend, files are read into data URLs and held in the
// form value — swap the read step for a POST to your storage when you have one.
function FileField({ multiple, value, disabled, onChange, id, invalid, required, describedBy }: { multiple: boolean; value: unknown; disabled: boolean; onChange: (v: StoredFile[]) => void; id?: string; invalid?: boolean; required?: boolean; describedBy?: string }) {
  const files = Array.isArray(value) ? (value as StoredFile[]) : [];
  const handle = (ev: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(ev.target.files ?? []);
    Promise.all(
      list.map(
        (f) =>
          new Promise<StoredFile>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve({ name: f.name, url: String(reader.result) });
            reader.readAsDataURL(f);
          })
      )
    ).then((read) => onChange(multiple ? read : read.slice(0, 1)));
  };
  return (
    <div>
      <input type="file" id={id} aria-invalid={invalid || undefined} aria-required={required || undefined} aria-describedby={describedBy} multiple={multiple} disabled={disabled} onChange={handle} className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-600 dark:text-gray-300" />
      {files.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs text-gray-500">
          {files.map((f, i) => <li key={i}>📎 {f.name}</li>)}
        </ul>
      )}
    </div>
  );
}

const CONTAINER = new Set(["panel", "fieldset", "columns", "well", "table", "cell", "dataGrid", "editGrid", "tabs", "tab"]);
const GRID = new Set(["dataGrid", "editGrid"]);
const STATIC = new Set(["button", "content", "heading", "divider", "next", "previous"]);

const textareaClass =
  "w-full rounded-lg border border-gray-300 bg-transparent px-3 py-2 text-sm text-gray-800 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/20 dark:border-gray-700 dark:text-white/90";

// Textarea that grows to fit its content.
function AutoTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) { el.style.height = "auto"; el.style.height = `${el.scrollHeight}px`; }
  }, [props.value]);
  return <textarea ref={ref} {...props} style={{ overflow: "hidden", resize: "none", ...props.style }} />;
}

// Full WYSIWYG rich-text editor (TipTap). Value stored as HTML.
function RichText({ value, onChange, disabled }: { value: unknown; onChange: (v: unknown) => void; disabled: boolean }) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: typeof value === "string" ? value : "",
    editable: !disabled,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: { attributes: { class: "prose prose-sm max-w-none min-h-[7rem] px-3 py-2 focus:outline-none dark:text-white/90 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_h1]:text-xl [&_h1]:font-bold [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:font-semibold" } },
  });
  if (!editor) return null;
  const btn = (active: boolean) => `rounded px-2 py-1 text-sm transition ${active ? "bg-brand-50 text-brand-600 dark:bg-brand-500/15" : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/10"}`;
  return (
    <div className="rounded-lg border border-gray-300 dark:border-gray-700">
      <div className="flex flex-wrap gap-0.5 border-b border-gray-200 p-1 dark:border-gray-700">
        <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={`${btn(editor.isActive("bold"))} font-bold`}>B</button>
        <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={`${btn(editor.isActive("italic"))} italic`}>I</button>
        <button type="button" onClick={() => editor.chain().focus().toggleUnderline().run()} className={`${btn(editor.isActive("underline"))} underline`}>U</button>
        <button type="button" onClick={() => editor.chain().focus().toggleStrike().run()} className={`${btn(editor.isActive("strike"))} line-through`}>S</button>
        <span className="mx-0.5 w-px self-stretch bg-gray-200 dark:bg-gray-700" />
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={btn(editor.isActive("heading", { level: 2 }))}>H</button>
        <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={btn(editor.isActive("bulletList"))}>• List</button>
        <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={btn(editor.isActive("orderedList"))}>1. List</button>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

type NumberOpts = { delimiter?: boolean; decimalLimit?: number; requireDecimal?: boolean; currency?: string };
function formatNumber(raw: string, opts: NumberOpts): string {
  if (raw === "" || raw === "-") return raw;
  const n = parseFloat(raw);
  if (Number.isNaN(n)) return raw;
  if (opts.currency) {
    try { return new Intl.NumberFormat(undefined, { style: "currency", currency: opts.currency }).format(n); } catch { /* fall through */ }
  }
  let s: string;
  if (typeof opts.decimalLimit === "number") {
    s = opts.requireDecimal ? n.toFixed(opts.decimalLimit) : String(Math.round(n * 10 ** opts.decimalLimit) / 10 ** opts.decimalLimit);
  } else {
    s = String(n);
  }
  if (opts.delimiter) {
    const [int, dec] = s.split(".");
    s = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (dec != null ? "." + dec : "");
  }
  return s;
}

// Number input with optional thousands separator / decimal formatting. Shows
// the raw value while focused (no cursor jumps), formatted when blurred.
function NumberField(props: { value: unknown; onChange: (v: unknown) => void; opts: NumberOpts; className?: string; placeholder?: string; disabled?: boolean; tabIndex?: number; autoFocus?: boolean; id?: string; invalid?: boolean; required?: boolean; describedBy?: string }) {
  const [focused, setFocused] = useState(false);
  const raw = props.value === undefined || props.value === null ? "" : String(props.value);
  const formatted = props.opts.delimiter || props.opts.decimalLimit != null || props.opts.currency ? formatNumber(raw, props.opts) : raw;
  return (
    <input
      type="text"
      inputMode="decimal"
      id={props.id}
      aria-invalid={props.invalid || undefined}
      aria-required={props.required || undefined}
      aria-describedby={props.describedBy}
      className={props.className}
      placeholder={props.placeholder}
      disabled={props.disabled}
      tabIndex={props.tabIndex}
      autoFocus={props.autoFocus}
      value={focused ? raw : formatted}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={(e) => props.onChange(e.target.value.replace(/[^0-9.-]/g, ""))}
    />
  );
}

// Signature pad — draw with mouse/touch, store as a PNG data URL.
function SignaturePad({ value, onChange, penColor, disabled, id, labelId, invalid, describedBy }: { value: unknown; onChange: (v: unknown) => void; penColor: string; disabled: boolean; id?: string; labelId?: string; invalid?: boolean; describedBy?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (ctx && typeof value === "string" && value) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0);
      img.src = value;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const point = (e: React.MouseEvent | React.TouchEvent) => {
    const r = ref.current!.getBoundingClientRect();
    const t = "touches" in e ? e.touches[0] : (e as React.MouseEvent);
    return { x: t.clientX - r.left, y: t.clientY - r.top };
  };
  const start = (e: React.MouseEvent | React.TouchEvent) => {
    if (disabled) return;
    drawing.current = true;
    const ctx = ref.current!.getContext("2d")!;
    const { x, y } = point(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };
  const move = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing.current) return;
    const ctx = ref.current!.getContext("2d")!;
    ctx.strokeStyle = penColor || "#000000";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    const { x, y } = point(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };
  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    onChange(ref.current!.toDataURL());
  };
  const clear = () => {
    const c = ref.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    onChange("");
  };
  return (
    <div>
      <canvas
        ref={ref}
        id={id}
        role="img"
        tabIndex={disabled ? -1 : 0}
        aria-labelledby={labelId}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        width={500}
        height={160}
        className="max-w-full touch-none rounded-lg border border-gray-300 bg-white focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/20 dark:border-gray-700"
        onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
        onTouchStart={start} onTouchMove={move} onTouchEnd={end}
      />
      <button type="button" onClick={clear} className="mt-1 block text-xs text-gray-500 hover:text-error-500">Clear</button>
    </div>
  );
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
type DayOpts = { hideDay?: boolean; hideMonth?: boolean; hideYear?: boolean; dayFirst?: boolean; minYear?: number; maxYear?: number };
function DayField({ value, onChange, opts, disabled, id, labelId, invalid, describedBy }: { value: unknown; onChange: (v: unknown) => void; opts: DayOpts; disabled: boolean; id?: string; labelId?: string; invalid?: boolean; describedBy?: string }) {
  const parts = (typeof value === "string" ? value : "").split("-");
  const yy = parts[0] ?? "", mm = parts[1] ?? "", dd = parts[2] ?? "";
  const now = new Date().getFullYear();
  const maxY = opts.maxYear ?? now + 10;
  const minY = opts.minYear ?? now - 100;
  const cls = "h-11 rounded-lg border border-gray-300 bg-transparent px-2 text-sm text-gray-800 focus:border-brand-300 focus:outline-hidden dark:border-gray-700 dark:text-white/90";
  const emit = (y: string, m: string, d: string) => onChange(`${y}-${m}-${d}`);
  const months = (
    <select key="m" aria-label="Month" disabled={disabled} className={cls} value={mm} onChange={(e) => emit(yy, e.target.value, dd)}>
      <option value="">Month</option>
      {MONTHS.map((mn, i) => <option key={mn} value={String(i + 1).padStart(2, "0")}>{mn}</option>)}
    </select>
  );
  // Valid days for the chosen month/year (leap-safe when year is blank).
  const daysInMonth = mm ? new Date(Number(yy) || 2024, Number(mm), 0).getDate() : 31;
  const days = (
    <select key="d" aria-label="Day" disabled={disabled} className={cls} value={dd} onChange={(e) => emit(yy, mm, e.target.value)}>
      <option value="">Day</option>
      {Array.from({ length: daysInMonth }, (_, i) => <option key={i} value={String(i + 1).padStart(2, "0")}>{i + 1}</option>)}
    </select>
  );
  const years = (
    <select key="y" aria-label="Year" disabled={disabled} className={cls} value={yy} onChange={(e) => emit(e.target.value, mm, dd)}>
      <option value="">Year</option>
      {Array.from({ length: maxY - minY + 1 }, (_, i) => maxY - i).map((y) => <option key={y} value={String(y)}>{y}</option>)}
    </select>
  );
  const order = (opts.dayFirst ? [["d", days], ["m", months]] : [["m", months], ["d", days]]) as [string, React.ReactNode][];
  order.push(["y", years]);
  const visible = order.filter(([k]) => (k === "d" && !opts.hideDay) || (k === "m" && !opts.hideMonth) || (k === "y" && !opts.hideYear));
  return (
    <div id={id} role="group" aria-labelledby={labelId} aria-invalid={invalid || undefined} aria-describedby={describedBy} className="flex gap-2">
      {visible.map(([, el]) => el)}
    </div>
  );
}

function SearchSelect({ options, value, onChange, placeholder, disabled, id, labelId, invalid, describedBy }: { options: Opt[]; value: string; onChange: (v: unknown) => void; placeholder: string; disabled: boolean; id?: string; labelId?: string; invalid?: boolean; describedBy?: string }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const selected = options.find((o) => o.value === value);
  const filtered = options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase()));
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={labelId}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className={`${inputClass} flex items-center justify-between text-left`}
        onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}
      >
        <span className={selected ? "" : "text-gray-400"}>{selected ? selected.label : placeholder || "Select…"}</span>
        <span aria-hidden className="text-gray-400">▾</span>
      </button>
      {open && (
        <div className="absolute z-30 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-theme-lg dark:border-gray-700 dark:bg-gray-900">
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" aria-label="Search options" className="w-full border-b border-gray-100 bg-transparent px-3 py-2 text-sm focus:outline-none dark:border-gray-800 dark:text-white/90" />
          <ul role="listbox" className="max-h-48 overflow-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-gray-400">No matches</li>
            ) : (
              filtered.map((o) => (
                <li key={o.value} role="option" aria-selected={o.value === value}>
                  <button type="button" onClick={() => { onChange(o.value); setOpen(false); setQ(""); }} className={`block w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-white/10 ${o.value === value ? "text-brand-600" : "text-gray-700 dark:text-gray-300"}`}>{o.label}</button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

// Tag chip input — Enter/comma adds, Backspace removes, ✕ to delete. Value = string[].
function TagsInput({ value, onChange, placeholder, disabled, id, labelId, invalid, describedBy }: { value: unknown; onChange: (v: unknown) => void; placeholder: string; disabled: boolean; id?: string; labelId?: string; invalid?: boolean; describedBy?: string }) {
  const tags = Array.isArray(value) ? (value as string[]) : typeof value === "string" && value ? value.split(",").map((s) => s.trim()).filter(Boolean) : [];
  const [draft, setDraft] = useState("");
  const add = () => { const t = draft.trim(); if (t && !tags.includes(t)) onChange([...tags, t]); setDraft(""); };
  return (
    <div className={`${inputClass} flex h-auto min-h-11 flex-wrap items-center gap-1.5 py-1.5`}>
      {tags.map((t, i) => (
        <span key={i} className="inline-flex items-center gap-1 rounded bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-600 dark:bg-brand-500/10">
          {t}
          <button type="button" onClick={() => onChange(tags.filter((_, j) => j !== i))} className="text-brand-400 hover:text-error-500" aria-label={`Remove ${t}`}>✕</button>
        </span>
      ))}
      <input
        id={id}
        aria-labelledby={labelId}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        value={draft}
        disabled={disabled}
        placeholder={tags.length ? "" : placeholder || "Add tags…"}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); }
          else if (e.key === "Backspace" && !draft && tags.length) onChange(tags.slice(0, -1));
        }}
        onBlur={add}
        className="min-w-[80px] flex-1 bg-transparent text-sm focus:outline-none dark:text-white/90"
      />
    </div>
  );
}

function parse(raw: string): ParsedSchema {
  try {
    const s = JSON.parse(raw);
    if (s && typeof s === "object" && s.entities && Array.isArray(s.root)) {
      // Repair dangling refs / cycles so a corrupted draft renders best-effort
      // instead of throwing or looping.
      return repairSchema(s as FormSchema).schema as unknown as ParsedSchema;
    }
  } catch {
    /* ignore */
  }
  return { entities: {}, root: [] };
}

const keyOf = (id: string, e: SchemaEntity) => asStr(e.attributes.key) || id;
const children = (e: SchemaEntity | undefined) => (Array.isArray((e as { children?: string[] })?.children) ? (e as { children?: string[] }).children! : []);
const coerce = (v: unknown) => (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v)) ? Number(v) : v ?? "");
const wordCount = (v: string) => (v.trim() ? v.trim().split(/\s+/).length : 0);

// Value-equality that treats numerically-equal primitives as the same (so a
// calculated `2` doesn't endlessly overwrite a typed `"2"`), with shallow array
// support. Used to gate calculated-value / setValue updates against churn.
const sameValue = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => sameValue(x, b[i]));
  if (a == null || b == null || typeof a === "object" || typeof b === "object") return false;
  const sa = String(a), sb = String(b);
  if (sa.trim() !== "" && sb.trim() !== "") {
    const na = Number(a), nb = Number(b);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na === nb;
  }
  return sa === sb;
};

// The type-appropriate "empty" for a field — so clearing on hide doesn't put a
// string "" into an array/boolean field.
const emptyValueFor = (e: SchemaEntity): unknown => {
  if (e.type === "checkbox") return false;
  if (e.type === "selectBoxes" || e.type === "file" || e.type === "tagsField") return [];
  if (GRID.has(e.type)) return [];
  if (e.type === "select" && Boolean(e.attributes.multiple)) return [];
  return "";
};

// Minimal input mask: 9=digit, a=letter, *=alphanumeric, others literal.
function maskValue(mask: string, raw: string): string {
  let out = "";
  let ri = 0;
  for (let mi = 0; mi < mask.length && ri < raw.length; mi++) {
    const m = mask[mi];
    if (m === "9" || m === "a" || m === "*") {
      const test = m === "9" ? /\d/ : m === "a" ? /[a-zA-Z]/ : /[a-zA-Z0-9]/;
      while (ri < raw.length && !test.test(raw[ri])) ri++;
      if (ri < raw.length) { out += raw[ri]; ri++; }
    } else {
      out += m;
      if (raw[ri] === m) ri++;
    }
  }
  return out;
}

const applyTextTransforms = (a: Record<string, unknown>, val: string): string => {
  let v = val;
  if (a.textCase === "uppercase") v = v.toUpperCase();
  else if (a.textCase === "lowercase") v = v.toLowerCase();
  if (typeof a.inputMask === "string" && a.inputMask) v = maskValue(a.inputMask, v);
  return v;
};

export default function FormRenderer({ schema }: { schema: string }) {
  const parsed = useMemo(() => parse(schema), [schema]);
  const { entities, root } = parsed;

  const [values, setValues] = useState<Record<string, unknown>>(() => {
    const init: Record<string, unknown> = {};
    const seed = (ids: string[]) => {
      for (const id of ids) {
        const e = entities[id];
        if (!e) continue;
        if (CONTAINER.has(e.type)) { if (!GRID.has(e.type)) seed(children(e)); continue; }
        if (e.type === "checkbox" && e.attributes.defaultChecked) { init[id] = true; continue; }
        const def = e.attributes.defaultValue;
        if (def !== undefined && def !== "") init[id] = def;
      }
    };
    seed(root);
    return init;
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState<Record<string, unknown> | null>(null);
  const [activeTabs, setActiveTabs] = useState<Record<string, number>>({});
  // Rich help content shown in a modal (e.g. Terms & Conditions on a checkbox).
  const [htmlModal, setHtmlModal] = useState<{ title: string; html: string } | null>(null);

  // A clickable "Terms and Conditions"-style link that opens the field's HTML
  // help content in a modal. Stops propagation so it doesn't toggle a checkbox.
  const contentLink = (e: SchemaEntity): React.ReactNode => {
    const text = asStr(e.attributes.contentLinkText);
    const html = asStr(e.attributes.contentHtml);
    if (!text || !html) return null;
    return (
      <button
        type="button"
        onClick={(ev) => { ev.preventDefault(); ev.stopPropagation(); setHtmlModal({ title: text, html }); }}
        className="ml-1 font-medium text-brand-600 underline hover:text-brand-700 dark:text-brand-400"
      >
        {text}
      </button>
    );
  };

  // Expression scope: every non-grid field by key (recursing through layout
  // containers, but not into grids — their values are row arrays).
  const scope = useMemo<Scope>(() => {
    const s: Scope = {};
    const walk = (ids: string[]) => {
      for (const id of ids) {
        const e = entities[id];
        if (!e) continue;
        if (GRID.has(e.type)) { s[keyOf(id, e)] = Array.isArray(values[id]) ? (values[id] as unknown[]) : []; continue; }
        if (CONTAINER.has(e.type)) { walk(children(e)); continue; }
        if (STATIC.has(e.type)) continue;
        s[keyOf(id, e)] = coerce(values[id]);
      }
    };
    walk(root);
    return s;
  }, [values, entities, root]);

  // Fields the user has manually edited (for "allow calculate override").
  const touched = useRef<Set<string>>(new Set());
  const didInit = useRef(false);

  // Custom default value (expression) — evaluated once on mount.
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    let changed = false;
    const next = { ...values };
    const walk = (ids: string[]) => {
      for (const id of ids) {
        const e = entities[id];
        if (!e) continue;
        if (CONTAINER.has(e.type)) { if (!GRID.has(e.type)) walk(children(e)); continue; }
        const expr = asStr(e.attributes.customDefaultValue);
        if (expr && (values[id] === undefined || values[id] === "")) {
          const computed = evaluateExpression(expr, scope);
          if (computed !== undefined) { next[id] = computed; changed = true; }
        }
      }
    };
    walk(root);
    if (changed) setValues(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Apply calculated values.
  useEffect(() => {
    let changed = false;
    const next = { ...values };
    const walk = (ids: string[]) => {
      for (const id of ids) {
        const e = entities[id];
        if (!e || GRID.has(e.type)) continue;
        if (CONTAINER.has(e.type)) { walk(children(e)); continue; }
        // Logic setValue rules (run before calculated value).
        const lg = evalLogic(e.attributes);
        if (lg.value !== undefined && !sameValue(lg.value, values[id])) { next[id] = lg.value; changed = true; }
        const expr = asStr(e.attributes.calculateValue);
        if (!expr) continue;
        // Once the user edits a field, stop recalculating if override is allowed.
        if (asBool(e.attributes.allowCalculateOverride) && touched.current.has(id)) continue;
        const computed = evaluateExpression(expr, scope);
        if (computed !== undefined && !sameValue(computed, values[id])) { next[id] = computed; changed = true; }
      }
    };
    walk(root);
    if (changed) setValues(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);

  const set = (id: string, value: unknown) => {
    touched.current.add(id);
    setValues((p) => ({ ...p, [id]: value }));
    setErrors((p) => (p[id] ? { ...p, [id]: "" } : p));
  };

  // Logic rules (triggers → actions). Returns whichever overrides fired.
  type LogicResult = { visible?: boolean; disabled?: boolean; required?: boolean; value?: unknown };
  const evalLogic = (a: Attrs): LogicResult => {
    const rules = Array.isArray(a.logic) ? (a.logic as { when: string; action: string; value?: string }[]) : [];
    const out: LogicResult = {};
    for (const r of rules) {
      if (!evaluateCondition(r.when, scope)) continue;
      switch (r.action) {
        case "show": out.visible = true; break;
        case "hide": out.visible = false; break;
        case "enable": out.disabled = false; break;
        case "disable": out.disabled = true; break;
        case "require": out.required = true; break;
        case "optional": out.required = false; break;
        case "setValue": out.value = evaluateExpression(r.value || "", scope); break;
      }
    }
    return out;
  };

  const isVisible = (e: SchemaEntity) => {
    const lg = evalLogic(e.attributes);
    if (lg.visible !== undefined) return lg.visible;
    if (asBool(e.attributes.hidden)) return false;
    const cond = e.attributes.conditional as { show?: boolean; when?: string; eq?: string } | undefined;
    if (cond?.when) {
      const match = String(scope[cond.when] ?? "") === String(cond.eq ?? "");
      if ((cond.show === false ? !match : match) === false) return false;
    }
    return evaluateCondition(asStr(e.attributes.customConditional), scope);
  };

  // Clear value when a field becomes hidden (clearOnHide).
  useEffect(() => {
    let changed = false;
    const next = { ...values };
    const walk = (ids: string[]) => {
      for (const id of ids) {
        const e = entities[id];
        if (!e) continue;
        if (CONTAINER.has(e.type)) { if (!GRID.has(e.type)) walk(children(e)); continue; }
        if (asBool(e.attributes.clearOnHide) && !isVisible(e) && values[id] !== undefined && values[id] !== "") {
          next[id] = emptyValueFor(e);
          changed = true;
        }
      }
    };
    walk(root);
    if (changed) setValues(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);

  const validateField = (e: SchemaEntity, v: unknown, ownScope: Scope): string | null => {
    const a = e.attributes;
    const name = asStr(a.errorLabel) || asStr(a.label) || "This field";
    const required = evalLogic(a).required ?? asBool(a.required);
    if (e.type === "day") {
      const [yy, mm, dd] = (typeof v === "string" ? v : "").split("-");
      const incomplete = (!a.hideYear && !yy) || (!a.hideMonth && !mm) || (!a.hideDay && !dd);
      if (required && incomplete) return asStr(a.customMessage) || `${name} is required`;
      return null;
    }
    const empty = v === undefined || v === "" || (Array.isArray(v) && v.length === 0);
    if (required && empty) return asStr(a.customMessage) || `${name} is required`;
    if (!empty && typeof v === "string") {
      const min = asNum(a.minLength), max = asNum(a.maxLength);
      if (min !== undefined && v.length < min) return asStr(a.customMessage) || `Must be at least ${min} characters`;
      if (max !== undefined && v.length > max) return asStr(a.customMessage) || `Must be at most ${max} characters`;
      const minW = asNum(a.minWords), maxW = asNum(a.maxWords);
      if (minW !== undefined && wordCount(v) < minW) return asStr(a.customMessage) || `Must be at least ${minW} words`;
      if (maxW !== undefined && wordCount(v) > maxW) return asStr(a.customMessage) || `Must be at most ${maxW} words`;
      const pattern = asStr(a.pattern);
      if (pattern) { try { if (!new RegExp(pattern).test(v)) return asStr(a.customMessage) || "Invalid format"; } catch { /* bad regex */ } }
      if (e.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return asStr(a.customMessage) || "Enter a valid email address";
      if (e.type === "url" && !/^https?:\/\/\S+$/.test(v)) return asStr(a.customMessage) || "Enter a valid URL (https://…)";
    }
    if (!empty && (e.type === "number" || e.type === "currency")) {
      const n = Number(v), min = asNum(a.min), max = asNum(a.max);
      if (min !== undefined && n < min) return asStr(a.customMessage) || `Must be ≥ ${min}`;
      if (max !== undefined && n > max) return asStr(a.customMessage) || `Must be ≤ ${max}`;
    }
    if (e.type === "selectBoxes") {
      const arr = Array.isArray(v) ? v : [];
      const maxS = asNum(a.maxSelected), minS = asNum(a.minSelected);
      if (maxS !== undefined && arr.length > maxS) return asStr(a.customMessage) || `Select at most ${maxS}`;
      if (minS !== undefined && arr.length < minS) return asStr(a.customMessage) || `Select at least ${minS}`;
    }
    if (!empty && e.type === "datetime" && typeof v === "string") {
      const minD = asStr(a.minDate), maxD = asStr(a.maxDate);
      if (minD && v < minD) return asStr(a.customMessage) || `Must be on or after ${minD}`;
      if (maxD && v > maxD) return asStr(a.customMessage) || `Must be on or before ${maxD}`;
    }
    const cv = asStr(a.customValidation);
    if (cv && !evaluateValidation(cv, ownScope)) return asStr(a.customMessage) || "Invalid value";
    return null;
  };

  // The data-field cell ids directly under a grid (skipping layout/static).
  const gridCellIds = (e: SchemaEntity) =>
    children(e).filter((cid) => entities[cid] && !CONTAINER.has(entities[cid].type) && !STATIC.has(entities[cid].type));

  // Fully validate every cell of every row (not just required-emptiness), using
  // a per-row scope so min/max/pattern/email and customValidation all apply
  // inside grids. Returns the first error message, or null.
  const validateGridRows = (e: SchemaEntity, rows: Record<string, unknown>[]): string | null => {
    if (asBool(e.attributes.required) && rows.length === 0) return "Add at least one row";
    const cellIds = gridCellIds(e);
    for (let ri = 0; ri < rows.length; ri++) {
      const row = rows[ri];
      const rowScope: Scope = {};
      for (const cid of cellIds) rowScope[keyOf(cid, entities[cid])] = coerce(row[cid]);
      for (const cid of cellIds) {
        const ce = entities[cid];
        const err = validateField(ce, row[cid], { ...rowScope, value: coerce(row[cid]) });
        if (err) return `Row ${ri + 1}: ${asStr(ce.attributes.label) || "field"} — ${err}`;
      }
    }
    return null;
  };

  // Renders just the input control for an entity, bound to value/onChange.
  const renderControl = (e: SchemaEntity, value: unknown, onChange: (v: unknown) => void, disabled: boolean, a11y?: FieldA11y) => {
    const a = e.attributes;
    // Text-like extras (Text Field parity): mask, text case, a11y attributes.
    const textExtras = {
      tabIndex: typeof a.tabIndex === "number" ? a.tabIndex : undefined,
      autoComplete: a.autocomplete === undefined ? undefined : a.autocomplete ? "on" : "off",
      autoFocus: asBool(a.autofocus),
      spellCheck: a.spellcheck === undefined ? undefined : asBool(a.spellcheck),
    };
    // ARIA attributes shared by single labelable controls (input/textarea/select).
    const aria = {
      id: a11y?.id,
      "aria-invalid": a11y?.invalid || undefined,
      "aria-required": a11y?.required || undefined,
      "aria-describedby": a11y?.describedBy,
    };
    const common = {
      value: asStr(value),
      onChange: (ev: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => onChange(applyTextTransforms(a, ev.target.value)),
      className: inputClass, placeholder: asStr(a.placeholder), disabled, ...aria, ...textExtras,
    };
    switch (e.type) {
      case "textarea": {
        if (asStr(a.editor) === "richtext") return <RichText value={value} disabled={disabled} onChange={(v) => onChange(v)} />;
        const rows = typeof a.rows === "number" ? a.rows : 3;
        if (asBool(a.autoExpand)) return <AutoTextarea {...common} className={textareaClass} rows={rows} />;
        return <textarea {...common} className={textareaClass} rows={rows} />;
      }
      case "number": case "currency": {
        const num = (
          <NumberField
            value={value}
            onChange={onChange}
            opts={{ delimiter: asBool(a.delimiter), decimalLimit: asNum(a.decimalLimit), requireDecimal: asBool(a.requireDecimal), currency: e.type === "currency" ? asStr(a.currencyCode) || undefined : undefined }}
            className={inputClass}
            placeholder={asStr(a.placeholder)}
            disabled={disabled}
            tabIndex={typeof a.tabIndex === "number" ? a.tabIndex : undefined}
            autoFocus={asBool(a.autofocus)}
            id={a11y?.id}
            invalid={a11y?.invalid}
            required={a11y?.required}
            describedBy={a11y?.describedBy}
          />
        );
        if (!asStr(a.prefix) && !asStr(a.suffix)) return num;
        return (
          <div className="flex items-center gap-1">
            {asStr(a.prefix) ? <span className="text-sm text-gray-500">{asStr(a.prefix)}</span> : null}
            {num}
            {asStr(a.suffix) ? <span className="text-sm text-gray-500">{asStr(a.suffix)}</span> : null}
          </div>
        );
      }
      case "password": return <input {...common} type="password" />;
      case "email": return <input {...common} type="email" />;
      case "url": return <input {...common} type="url" />;
      case "phoneNumber": return <input {...common} type="tel" />;
      case "datetime": return <input {...common} type={asBool(a.enableTime) ? "datetime-local" : "date"} min={asStr(a.minDate) || undefined} max={asStr(a.maxDate) || undefined} />;
      case "time": return <input {...common} type="time" />;
      case "tagsField": return <TagsInput value={value} onChange={onChange} placeholder={asStr(a.placeholder)} disabled={disabled} id={a11y?.id} labelId={a11y?.labelId} invalid={a11y?.invalid} describedBy={a11y?.describedBy} />;
      case "file": return <FileField multiple={asBool(a.multiple)} value={value} disabled={disabled} onChange={(v) => onChange(v)} id={a11y?.id} invalid={a11y?.invalid} required={a11y?.required} describedBy={a11y?.describedBy} />;
      case "signature": return <SignaturePad value={value} penColor={asStr(a.penColor) || "#000000"} disabled={disabled} onChange={(v) => onChange(v)} id={a11y?.id} labelId={a11y?.labelId} invalid={a11y?.invalid} describedBy={a11y?.describedBy} />;
      case "day":
        return <DayField value={value} onChange={onChange} disabled={disabled} opts={{ hideDay: asBool(a.hideDay), hideMonth: asBool(a.hideMonth), hideYear: asBool(a.hideYear), dayFirst: asBool(a.dayFirst), minYear: asNum(a.minYear), maxYear: asNum(a.maxYear) }} id={a11y?.id} labelId={a11y?.labelId} invalid={a11y?.invalid} describedBy={a11y?.describedBy} />;
      case "select": {
        if (asBool(a.searchable)) return <SearchSelect options={normOptions(a.options)} value={asStr(value)} onChange={onChange} placeholder={asStr(a.placeholder)} disabled={disabled} id={a11y?.id} labelId={a11y?.labelId} invalid={a11y?.invalid} describedBy={a11y?.describedBy} />;
        return (
          <select {...common}>
            <option value="">{asStr(a.placeholder) || "Select…"}</option>
            {normOptions(a.options).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        );
      }
      case "radio":
        return (
          <div role="radiogroup" id={a11y?.id} aria-labelledby={a11y?.labelId} aria-invalid={a11y?.invalid || undefined} aria-describedby={a11y?.describedBy} className={asBool(a.inline) ? "flex flex-wrap gap-4" : "space-y-2"}>
            {normOptions(a.options).map((o) => (
              <label key={o.value} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input type="radio" name={a11y?.id} checked={value === o.value} onChange={() => onChange(o.value)} disabled={disabled} className="size-4 text-brand-500" />{o.label}
              </label>
            ))}
          </div>
        );
      case "selectBoxes": {
        const sel = asArr(value);
        return (
          <div role="group" id={a11y?.id} aria-labelledby={a11y?.labelId} aria-invalid={a11y?.invalid || undefined} aria-describedby={a11y?.describedBy} className={asBool(a.inline) ? "flex flex-wrap gap-4" : "space-y-2"}>
            {normOptions(a.options).map((o) => (
              <label key={o.value} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input type="checkbox" checked={sel.includes(o.value)} disabled={disabled} onChange={(ev) => onChange(ev.target.checked ? [...sel, o.value] : sel.filter((x) => x !== o.value))} className="size-4 rounded text-brand-500" />{o.label}
              </label>
            ))}
          </div>
        );
      }
      case "checkbox":
        return <input type="checkbox" id={a11y?.id} aria-invalid={a11y?.invalid || undefined} aria-required={a11y?.required || undefined} aria-describedby={a11y?.describedBy} checked={asBool(value)} onChange={(ev) => onChange(ev.target.checked)} disabled={disabled} className="size-4 rounded text-brand-500" />;
      default: return <input {...common} type="text" />;
    }
  };

  const fieldWrapper = (id: string, e: SchemaEntity) => {
    const a = e.attributes;
    const hideLabel = asBool(a.hideLabel);
    const lg = evalLogic(a);
    const disabled = lg.disabled ?? asBool(a.disabled);
    const required = lg.required ?? asBool(a.required);
    const controlId = `f-${id}`, labelId = `l-${id}`, errId = `er-${id}`, descId = `de-${id}`;
    const hasErr = !!errors[id];
    if (e.type === "checkbox") {
      const a11y: FieldA11y = { id: controlId, labelId, invalid: hasErr, required, describedBy: hasErr ? errId : undefined };
      return (
        <div key={id}>
          <label htmlFor={controlId} id={labelId} className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            {renderControl(e, values[id], (v) => set(id, v), disabled, a11y)}
            {hideLabel ? null : (<span>{asStr(a.label)}{required ? <span className="text-error-500"> *</span> : null}{contentLink(e)}<FieldTooltip text={asStr(a.tooltip)} /></span>)}
          </label>
          {errors[id] ? <p id={errId} role="alert" className="mt-1 text-xs text-error-500">{errors[id]}</p> : null}
        </div>
      );
    }
    const str = asStr(values[id]);
    const counters = [
      asBool(a.showCharCount) ? `${str.length} characters` : null,
      asBool(a.showWordCount) ? `${wordCount(str)} words` : null,
    ].filter(Boolean).join(" · ");
    const labelable = !NON_LABELABLE.has(e.type);
    const describedBy = [
      hasErr ? errId : null,
      asStr(a.description) ? descId : null,
      counters ? `${descId}-c` : null,
    ].filter(Boolean).join(" ") || undefined;
    const a11y: FieldA11y = { id: controlId, labelId, invalid: hasErr, required, describedBy };
    return (
      <div key={id}>
        {hideLabel ? null : (
          <label htmlFor={labelable ? controlId : undefined} id={labelId} className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
            {asStr(a.label)}{required ? <span className="text-error-500"> *</span> : null}{contentLink(e)}<FieldTooltip text={asStr(a.tooltip)} />
          </label>
        )}
        {renderControl(e, values[id], (v) => set(id, v), disabled, a11y)}
        {asStr(a.footer) ? <p className="mt-1 text-xs text-gray-400">{asStr(a.footer)}</p> : null}
        <div className="mt-1 flex items-center justify-between gap-2">
          {asStr(a.description) ? <p id={descId} className="text-xs text-gray-400">{asStr(a.description)}</p> : <span />}
          {counters ? <p id={`${descId}-c`} className="text-xs text-gray-400">{counters}</p> : null}
        </div>
        {errors[id] ? <p id={errId} role="alert" className="mt-1 text-xs text-error-500">{errors[id]}</p> : null}
      </div>
    );
  };

  // Repeating rows (Data Grid / Edit Grid).
  const renderGrid = (id: string, e: SchemaEntity) => {
    const a = e.attributes;
    const rows = Array.isArray(values[id]) ? (values[id] as Record<string, unknown>[]) : [];
    const fieldIds = children(e).filter((cid) => entities[cid] && !CONTAINER.has(entities[cid].type) && !STATIC.has(entities[cid].type));
    const setRows = (next: Record<string, unknown>[]) => set(id, next);
    const edit = e.type === "editGrid";
    return (
      <div key={id}>
        <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
          {asStr(a.label)}{asBool(a.required) ? <span className="text-error-500"> *</span> : null}
        </label>
        <div className="space-y-3">
          {rows.map((row, ri) => (
            <div key={ri} className={`relative rounded-xl border border-gray-200 p-4 dark:border-gray-700 ${edit ? "bg-gray-50 dark:bg-white/5" : ""}`}>
              <div className={edit ? "space-y-3" : "grid gap-3 sm:grid-cols-2"}>
                {fieldIds.map((cid) => {
                  const ce = entities[cid];
                  const cellId = `g-${id}-${ri}-${cid}`, cellLabelId = `${cellId}-l`;
                  const cellA11y: FieldA11y = { id: cellId, labelId: cellLabelId, invalid: false, required: asBool(ce.attributes.required), describedBy: undefined };
                  return (
                    <div key={cid}>
                      <label htmlFor={NON_LABELABLE.has(ce.type) ? undefined : cellId} id={cellLabelId} className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">{asStr(ce.attributes.label)}</label>
                      {renderControl(ce, row[cid], (v) => { const n = rows.map((r, i) => (i === ri ? { ...r, [cid]: v } : r)); setRows(n); }, false, cellA11y)}
                    </div>
                  );
                })}
              </div>
              <button type="button" onClick={() => setRows(rows.filter((_, i) => i !== ri))} className="absolute right-2 top-2 text-xs text-gray-400 hover:text-error-500">Remove</button>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => setRows([...rows, {}])} className="mt-2 text-sm font-medium text-brand-500 hover:text-brand-600">+ Add {edit ? "entry" : "row"}</button>
        {errors[id] ? <p role="alert" className="mt-1 text-xs text-error-500">{errors[id]}</p> : null}
      </div>
    );
  };

  type Wiz = { tabsId: string; index: number; total: number };

  // Validate the visible fields under `ids`, returning an errors map.
  const collectErrors = (ids: string[]): Record<string, string> => {
    const errs: Record<string, string> = {};
    const walk = (list: string[]) => {
      for (const id of list) {
        const ce = entities[id];
        if (!ce || !isVisible(ce)) continue;
        if (GRID.has(ce.type)) {
          const rows = Array.isArray(values[id]) ? (values[id] as Record<string, unknown>[]) : [];
          const gerr = validateGridRows(ce, rows);
          if (gerr) errs[id] = gerr;
          continue;
        }
        if (CONTAINER.has(ce.type)) { walk(children(ce)); continue; }
        if (STATIC.has(ce.type)) continue;
        const err = validateField(ce, values[id], { ...scope, value: scope[keyOf(id, ce)] });
        if (err) errs[id] = err;
      }
    };
    walk(ids);
    return errs;
  };

  const renderEntity = (id: string, wiz?: Wiz): React.ReactNode => {
    const e = entities[id];
    if (!e || !isVisible(e)) return null;
    const a = e.attributes;
    if (e.type === "divider") return <hr key={id} className="border-gray-200 dark:border-gray-700" />;
    if (e.type === "heading") return <h3 key={id} className="text-lg font-semibold text-gray-800 dark:text-white/90">{asStr(a.label)}</h3>;
    if (e.type === "content") return <p key={id} className="text-sm text-gray-600 dark:text-gray-400">{asStr(a.content)}</p>;
    if (e.type === "button")
      return <button key={id} type="submit" className="rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-600">{asStr(a.label) || "Submit"}</button>;
    if (e.type === "next" || e.type === "previous") {
      const goNext = e.type === "next";
      const onClick = () => {
        if (!wiz) return;
        if (goNext && asBool(a.blockedByValidation)) {
          const tabChildren = children(entities[wiz.tabsId]).filter((tid) => entities[tid]?.type === "tab" && isVisible(entities[tid]));
          const curTab = tabChildren[wiz.index];
          const errs = curTab ? collectErrors(children(entities[curTab])) : {};
          if (Object.keys(errs).length) { setErrors((p) => ({ ...p, ...errs })); return; }
        }
        setActiveTabs((p) => ({ ...p, [wiz.tabsId]: Math.min(Math.max(0, wiz.index + (goNext ? 1 : -1)), wiz.total - 1) }));
      };
      const atEdge = !wiz || (goNext ? wiz.index >= wiz.total - 1 : wiz.index <= 0);
      return (
        <button
          key={id}
          type="button"
          onClick={onClick}
          disabled={atEdge}
          className={goNext
            ? "rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-40"
            : "rounded-lg border border-brand-300 px-5 py-2.5 text-sm font-medium text-brand-600 hover:bg-brand-50 disabled:opacity-40 dark:hover:bg-white/5"}
        >
          {asStr(a.label) || (goNext ? "Next" : "Previous")}
        </button>
      );
    }
    if (e.type === "panel" || e.type === "fieldset")
      return (
        <fieldset key={id} className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
          {asStr(a.label) ? <legend className="px-1 text-sm font-semibold text-gray-700 dark:text-gray-300">{asStr(a.label)}</legend> : null}
          <div className="space-y-5">{children(e).map((cid) => renderEntity(cid, wiz))}</div>
        </fieldset>
      );
    if (e.type === "columns")
      return <div key={id} className="grid gap-4 sm:grid-cols-2">{children(e).map((cid) => renderEntity(cid, wiz))}</div>;
    if (e.type === "well")
      return <div key={id} className="space-y-5 rounded-xl bg-gray-50 p-4 dark:bg-white/5">{children(e).map((cid) => renderEntity(cid, wiz))}</div>;
    if (e.type === "table") {
      const cols = typeof a.numColumns === "number" ? a.numColumns : 2;
      return <div key={id} className="grid gap-4" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>{children(e).map((cid) => renderEntity(cid, wiz))}</div>;
    }
    if (e.type === "cell")
      return <div key={id} className="space-y-3">{children(e).map((cid) => renderEntity(cid, wiz))}</div>;
    if (e.type === "tabs") {
      const tabIds = children(e).filter((tid) => entities[tid]?.type === "tab" && isVisible(entities[tid]));
      const active = Math.min(activeTabs[id] ?? 0, Math.max(0, tabIds.length - 1));
      const cur = tabIds[active];
      return (
        <div key={id}>
          <div className="flex flex-wrap gap-1 border-b border-gray-200 dark:border-gray-700">
            {tabIds.map((tid, i) => (
              <button
                key={tid}
                type="button"
                onClick={() => setActiveTabs((p) => ({ ...p, [id]: i }))}
                className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition ${active === i ? "border-brand-500 text-brand-600" : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400"}`}
              >
                {asStr(entities[tid].attributes.label) || `Tab ${i + 1}`}
              </button>
            ))}
          </div>
          <div className="space-y-5 pt-4">
            {cur ? children(entities[cur]).map((cid) => renderEntity(cid, { tabsId: id, index: active, total: tabIds.length })) : null}
          </div>
        </div>
      );
    }
    if (e.type === "tab") return <div key={id} className="space-y-5">{children(e).map((cid) => renderEntity(cid, wiz))}</div>;
    if (GRID.has(e.type)) return renderGrid(id, e);
    return fieldWrapper(id, e);
  };

  const onSubmit = (ev: React.FormEvent) => {
    ev.preventDefault();
    const next: Record<string, string> = {};
    const data: Record<string, unknown> = {};
    const walk = (ids: string[]) => {
      for (const id of ids) {
        const e = entities[id];
        if (!e || !isVisible(e)) continue;
        if (GRID.has(e.type)) {
          const rows = Array.isArray(values[id]) ? (values[id] as Record<string, unknown>[]) : [];
          const gerr = validateGridRows(e, rows);
          if (gerr) next[id] = gerr;
          // Emit rows keyed by each cell's field key — never the internal entity id.
          const cellIds = gridCellIds(e);
          data[keyOf(id, e)] = rows.map((row) => {
            const out: Record<string, unknown> = {};
            for (const cid of cellIds) out[keyOf(cid, entities[cid])] = row[cid] ?? null;
            return out;
          });
          continue;
        }
        if (CONTAINER.has(e.type)) { walk(children(e)); continue; }
        if (STATIC.has(e.type)) continue;
        const err = validateField(e, values[id], { ...scope, value: scope[keyOf(id, e)] });
        if (err) next[id] = err;
        else if (e.attributes.persistent !== false) data[keyOf(id, e)] = values[id] ?? null;
      }
    };
    walk(root);
    setErrors(next);
    if (Object.keys(next).length === 0) setSubmitted(data);
  };

  if (root.length === 0) return <p className="py-10 text-center text-sm text-gray-400">This form has no fields yet.</p>;

  const hasButton = root.some((id) => entities[id]?.type === "button");

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {root.map((id) => renderEntity(id))}
      {!hasButton && (
        <button type="submit" className="rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-600">Submit</button>
      )}
      {submitted && (
        <div className="rounded-xl border border-success-500/30 bg-success-50 p-4 dark:bg-success-500/10" role="status">
          <p className="mb-2 text-sm font-medium text-success-600">Submitted ✓</p>
          <pre className="overflow-auto text-xs text-gray-600 dark:text-gray-300">{JSON.stringify(submitted, null, 2)}</pre>
        </div>
      )}

      {/* Rich help content (sanitized HTML) — e.g. Terms & Conditions. */}
      <Modal isOpen={!!htmlModal} onClose={() => setHtmlModal(null)} className="mx-4 max-h-[80vh] w-full max-w-[640px] overflow-y-auto">
        <div className="p-6 sm:p-8">
          {htmlModal?.title ? <h2 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white/90">{htmlModal.title}</h2> : null}
          <div
            className="prose prose-sm max-w-none text-gray-700 dark:prose-invert dark:text-gray-300 [&_a]:text-brand-600 [&_h1]:text-xl [&_h1]:font-bold [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:font-semibold [&_li]:my-0.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_ul]:list-disc [&_ul]:pl-5"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(htmlModal?.html ?? "") }}
          />
        </div>
      </Modal>
    </form>
  );
}
