import { createBuilder } from "@coltorapps/builder";
import {
  buttonEntity,
  cellEntity,
  checkboxEntity,
  columnsEntity,
  contentEntity,
  currencyEntity,
  dataGridEntity,
  dayEntity,
  datetimeEntity,
  dividerEntity,
  editGridEntity,
  emailEntity,
  fieldsetEntity,
  fileEntity,
  headingEntity,
  nextEntity,
  numberEntity,
  panelEntity,
  passwordEntity,
  phoneEntity,
  previousEntity,
  radioEntity,
  selectBoxesEntity,
  selectEntity,
  signatureEntity,
  tabEntity,
  tabsEntity,
  tableEntity,
  tagsFieldEntity,
  textareaEntity,
  textFieldEntity,
  timeEntity,
  urlEntity,
  wellEntity,
} from "./entities";

export const formBuilder = createBuilder({
  entities: [
    textFieldEntity, textareaEntity, numberEntity, passwordEntity, checkboxEntity,
    selectBoxesEntity, selectEntity, radioEntity, buttonEntity,
    emailEntity, urlEntity, phoneEntity, currencyEntity, datetimeEntity, timeEntity, dayEntity, tagsFieldEntity, fileEntity, signatureEntity,
    contentEntity, headingEntity, dividerEntity,
    panelEntity, fieldsetEntity, columnsEntity, wellEntity, tableEntity, cellEntity, dataGridEntity, editGridEntity, tabsEntity, tabEntity,
    nextEntity, previousEntity,
  ],
});

// Field types that hold children (rendered as droppable containers).
export const CONTAINER_TYPES = new Set(["panel", "fieldset", "columns", "well", "table", "cell", "dataGrid", "editGrid", "tabs", "tab"]);
export const GRID_TYPES = new Set(["dataGrid", "editGrid"]);

export type PaletteItem = {
  type: string;
  label: string;
  defaults: Record<string, unknown>;
};

// Palette grouped like Form.io. `defaults` seeds required attributes on add.
export const PALETTE_GROUPS: { group: string; items: PaletteItem[] }[] = [
  {
    group: "Basic",
    items: [
      { type: "textField", label: "Text Field", defaults: { label: "Text Field" } },
      { type: "textarea", label: "Text Area", defaults: { label: "Text Area" } },
      { type: "number", label: "Number", defaults: { label: "Number" } },
      { type: "password", label: "Password", defaults: { label: "Password" } },
      { type: "checkbox", label: "Checkbox", defaults: { label: "Checkbox" } },
      { type: "selectBoxes", label: "Select Boxes", defaults: { label: "Select Boxes", options: ["Option 1"] } },
      { type: "select", label: "Select", defaults: { label: "Select", options: ["Option 1"] } },
      { type: "radio", label: "Radio", defaults: { label: "Radio", options: ["Option 1"] } },
      { type: "button", label: "Button", defaults: { label: "Submit" } },
    ],
  },
  {
    group: "Advanced",
    items: [
      { type: "email", label: "Email", defaults: { label: "Email" } },
      { type: "url", label: "URL", defaults: { label: "URL" } },
      { type: "phoneNumber", label: "Phone Number", defaults: { label: "Phone Number", inputMask: "(999) 999-9999" } },
      { type: "currency", label: "Currency", defaults: { label: "Currency", currencyCode: "USD", delimiter: true, decimalLimit: 2, requireDecimal: true } },
      { type: "datetime", label: "Date / Time", defaults: { label: "Date / Time" } },
      { type: "time", label: "Time", defaults: { label: "Time" } },
      { type: "day", label: "Day", defaults: { label: "Day" } },
      { type: "tagsField", label: "Tags", defaults: { label: "Tags" } },
      { type: "file", label: "File Upload", defaults: { label: "File Upload" } },
      { type: "signature", label: "Signature", defaults: { label: "Signature" } },
    ],
  },
  {
    group: "Layout",
    items: [
      { type: "panel", label: "Panel", defaults: { label: "Panel" } },
      { type: "columns", label: "Columns", defaults: {} },
      { type: "tabs", label: "Tabs", defaults: {} },
      { type: "table", label: "Table", defaults: { numColumns: 2 } },
      { type: "well", label: "Well", defaults: {} },
      { type: "fieldset", label: "Field Set", defaults: { label: "Field Set" } },
      { type: "content", label: "Content", defaults: { content: "Add your content here." } },
      { type: "heading", label: "Heading", defaults: { label: "Heading" } },
      { type: "divider", label: "Divider", defaults: {} },
    ],
  },
  {
    group: "Data",
    items: [
      { type: "dataGrid", label: "Data Grid", defaults: { label: "Data Grid" } },
      { type: "editGrid", label: "Edit Grid", defaults: { label: "Edit Grid" } },
    ],
  },
  {
    group: "Wizard",
    items: [
      { type: "previous", label: "Previous", defaults: { label: "Previous" } },
      { type: "next", label: "Next", defaults: { label: "Next", blockedByValidation: true } },
    ],
  },
];
