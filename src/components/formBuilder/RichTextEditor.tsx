import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

// Shared TipTap WYSIWYG editor. Value is stored as HTML. Used both for the
// rich-text textarea field (fill) and for authoring help content in the builder.
export default function RichTextEditor({
  value,
  onChange,
  disabled = false,
  minHeightClass = "min-h-[7rem]",
}: {
  value: unknown;
  onChange: (html: string) => void;
  disabled?: boolean;
  minHeightClass?: string;
}) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: typeof value === "string" ? value : "",
    editable: !disabled,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: `prose prose-sm max-w-none ${minHeightClass} px-3 py-2 focus:outline-none dark:text-white/90 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_h1]:text-xl [&_h1]:font-bold [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:font-semibold`,
      },
    },
  });
  if (!editor) return null;
  const btn = (active: boolean) =>
    `rounded px-2 py-1 text-sm transition ${active ? "bg-brand-50 text-brand-600 dark:bg-brand-500/15" : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/10"}`;
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
