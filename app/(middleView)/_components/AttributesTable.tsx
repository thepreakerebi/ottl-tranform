"use client";

import { Label } from "../../../components/ui/label";
import { Button } from "../../../components/ui/button";
import ActionMenu from "./ActionMenu";
import EditAttributeDialog from "./EditAttributeDialog";
import MaskAttributeDialog from "./MaskAttributeDialog";
import RemoveAttributeDialog from "./RemoveAttributeDialog";
import { useState } from "react";
import { useTelemetryStore } from "../../../lib/stores/telemetryStore";
import { usePreviewStore } from "../../../lib/stores/previewStore";
import { useOttlStore } from "../../../lib/stores/ottlStore";

type AttributeKV = { key: string; value: Record<string, unknown> };

type RowActions = {
  onRemove?: (key: string) => void;
  onMask?: (key: string) => void;
};

type Props = {
  title?: string;
  attributes?: unknown;
  actions?: RowActions;
  onAddAttribute?: () => void;
};

export default function AttributesTable({ title = "Attributes", attributes, actions, onAddAttribute }: Props) {
  const rows = normalizeAttributes(attributes);
  const [editOpen, setEditOpen] = useState(false);
  const [editRow, setEditRow] = useState<{ key: string; value: string } | null>(null);
  const [maskOpen, setMaskOpen] = useState(false);
  const [maskRow, setMaskRow] = useState<{ key: string; value: string } | null>(null);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [removeRow, setRemoveRow] = useState<{ key: string; value: string } | null>(null);
  if (rows.length === 0) return null;
  return (
    <section aria-label={title} className="mt-3">
      <header className="mb-2 flex items-center justify-between gap-2">
        <Label className="text-xs font-medium">{title}</Label>
        {onAddAttribute && (
          <Button type="button" variant="outline" size="sm" className="rounded-[6px]" onClick={onAddAttribute}>Add attribute</Button>
        )}
      </header>
      <table className="w-full text-xs">
        <thead>
          <tr>
            <th scope="col" className="text-left font-semibold py-1 pr-2">Key</th>
            <th scope="col" className="text-left font-semibold py-1">Value</th>
            {actions && (actions.onRemove || actions.onMask) ? (
              <th scope="col" className="text-center font-semibold py-1 pr-1">Actions</th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={`${r.key}-${i}`} className="border-t align-top">
              <th scope="row" data-attr-key={r.key} className="py-1 pr-2 text-left text-foreground/90 font-medium whitespace-nowrap align-middle">{r.key}</th>
              <td className="py-1 text-left text-foreground/80 break-words align-middle">{r.value}</td>
              {actions && (actions.onRemove || actions.onMask) ? (
                <td className="py-1 text-center whitespace-nowrap align-middle">
                  <ActionMenu
                    onEdit={() => { setEditRow(r); setEditOpen(true); }}
                    onMask={() => { setMaskRow(r); setMaskOpen(true); }}
                    onRemove={() => { setRemoveRow(r); setRemoveOpen(true); }}
                  />
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
      <EditAttributeDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        initialKey={editRow?.key ?? ""}
        initialValue={editRow?.value ?? ""}
        onSubmit={(nextKey, nextValue) => {
          // optimistic: replace and produce a proper before/after snapshot for RightPanel
          try {
            const tele = useTelemetryStore.getState();
            const beforeClone = tele.parsed ? JSON.parse(JSON.stringify(tele.parsed)) : null;

            // Create a complete copy of the telemetry data to avoid mutating shared references
            const telemetryCopy = tele.parsed ? JSON.parse(JSON.stringify(tele.parsed)) : null;
            
            // Apply the change to the copy, not the original
            const list = Array.isArray(attributes) ? (attributes as Array<{ key: string; value: Record<string, unknown> }>) : [];
            const idx = list.findIndex((kv) => kv.key === editRow?.key);
            if (idx >= 0 && telemetryCopy) {
              // Find and update the attribute in the copy
              const updateAttributesInCopy = (obj: unknown, oldKey: string, newKey: string, newVal: string) => {
                if (!obj || typeof obj !== "object") return;
                const record = obj as Record<string, unknown>;
                // if this object has an attributes array
                const maybeWithAttrs = record as { attributes?: Array<{ key?: string; value?: Record<string, unknown> }> };
                if (Array.isArray(maybeWithAttrs.attributes)) {
                  const attrIdx = maybeWithAttrs.attributes.findIndex((kv) => (typeof kv?.key === "string") && kv.key === oldKey);
                  if (attrIdx >= 0) {
                    maybeWithAttrs.attributes[attrIdx] = { key: newKey, value: { stringValue: newVal } } as unknown as { key?: string; value?: Record<string, unknown> };
                  }
                }
                // Recurse into nested objects/arrays
                for (const val of Object.values(record)) {
                  if (val && typeof val === "object") updateAttributesInCopy(val, oldKey, newKey, newVal);
                }
              };
              updateAttributesInCopy(telemetryCopy, editRow?.key ?? "", nextKey, nextValue);
            }
            
            const afterClone = telemetryCopy;
            tele.setParsed(afterClone);
            const previews = usePreviewStore.getState();
            const nextStep = previews.snapshots.length;
            previews.setSnapshots([...previews.snapshots, { stepIndex: nextStep, before: beforeClone, after: afterClone }]);
            previews.setStepIndex(nextStep);
            previews.setAutoJump(true);

            // Append OTTL equivalent comment + set/rename operation
            try {
              const ottl = useOttlStore.getState();
              const quote = (s: string) => `"${s.replace(/"/g, '\\"')}"`;
              // When key changed, emulate rename via set(new) + delete(old). For simplicity, we always set new key.
              const stmt = `set(attributes[${quote(nextKey)}], ${quote(nextValue)})`;
              const nextText = [ottl.text, `# auto: edit attribute`, stmt].filter(Boolean).join("\n").trim();
              ottl.setText(nextText);
              ottl.setLastCompiled(nextText);
            } catch {}
          } catch {}
        }}
      />
      <MaskAttributeDialog
        open={maskOpen}
        onOpenChange={setMaskOpen}
        attributeKey={maskRow?.key ?? ""}
        currentValue={maskRow?.value ?? ""}
        onSubmit={(start, end, maskChar = "*") => {
          try {
            const tele = useTelemetryStore.getState();
            const beforeClone = tele.parsed ? JSON.parse(JSON.stringify(tele.parsed)) : null;
            const telemetryCopy = tele.parsed ? JSON.parse(JSON.stringify(tele.parsed)) : null;
            const applyMask = (v: string) => {
              const s = Math.max(0, start);
              const e = end == null ? v.length : Math.max(s, end);
              const maskLen = Math.max(0, e - s);
              const masked = maskLen > 0 ? maskChar.repeat(maskLen) : maskChar;
              return v.slice(0, s) + masked + v.slice(e);
            };
            const updateMask = (obj: unknown, targetKey: string) => {
              if (!obj || typeof obj !== "object") return;
              const rec = obj as Record<string, unknown>;
              const maybeAttrs = rec as { attributes?: Array<{ key?: string; value?: Record<string, unknown> }> };
              if (Array.isArray(maybeAttrs.attributes)) {
                const idx = maybeAttrs.attributes.findIndex((kv) => (typeof kv?.key === "string") && kv.key === targetKey);
                if (idx >= 0) {
                  const cur = maybeAttrs.attributes[idx]?.value?.stringValue as string | undefined;
                  const next = applyMask(String(cur ?? ""));
                  maybeAttrs.attributes[idx] = { key: targetKey, value: { stringValue: next } } as unknown as { key?: string; value?: Record<string, unknown> };
                }
              }
              for (const val of Object.values(rec)) if (val && typeof val === "object") updateMask(val, targetKey);
            };
            if (telemetryCopy && maskRow?.key) updateMask(telemetryCopy, maskRow.key);
            const afterClone = telemetryCopy;
            tele.setParsed(afterClone);
            const previews = usePreviewStore.getState();
            const nextStep = previews.snapshots.length;
            previews.setSnapshots([...previews.snapshots, { stepIndex: nextStep, before: beforeClone, after: afterClone }]);
            previews.setStepIndex(nextStep);
            previews.setAutoJump(true);

            const ottl = useOttlStore.getState();
            const quote = (s: string) => `"${s.replace(/"/g, '\\"')}"`;
            const maskExpr = end == null
              ? `Concat([Substring(attributes[${quote(maskRow?.key ?? "")}], 0, ${start}), Repeat(${quote(maskChar)}, Len(attributes[${quote(maskRow?.key ?? "")}]) - ${start}), ""], "")`
              : `Concat([Substring(attributes[${quote(maskRow?.key ?? "")}], 0, ${start}), Repeat(${quote(maskChar)}, ${end} - ${start}), Substring(attributes[${quote(maskRow?.key ?? "")}], ${end})], "")`;
            const stmt = `set(attributes[${quote(maskRow?.key ?? "")}], ${maskExpr})`;
            const nextText = [ottl.text, `# auto: mask attribute`, stmt].filter(Boolean).join("\n").trim();
            ottl.setText(nextText);
            ottl.setLastCompiled(nextText);
          } catch {}
        }}
      />
      <RemoveAttributeDialog
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        attributeKey={removeRow?.key ?? ""}
        onConfirm={() => {
          try {
            const tele = useTelemetryStore.getState();
            const beforeClone = tele.parsed ? JSON.parse(JSON.stringify(tele.parsed)) : null;
            const telemetryCopy = tele.parsed ? JSON.parse(JSON.stringify(tele.parsed)) : null;
            const removeAttr = (obj: unknown, targetKey: string) => {
              if (!obj || typeof obj !== "object") return;
              const rec = obj as Record<string, unknown>;
              const maybeAttrs = rec as { attributes?: Array<{ key?: string; value?: Record<string, unknown> }> };
              if (Array.isArray(maybeAttrs.attributes)) {
                const idx = maybeAttrs.attributes.findIndex((kv) => (typeof kv?.key === "string") && kv.key === targetKey);
                if (idx >= 0) maybeAttrs.attributes.splice(idx, 1);
              }
              for (const val of Object.values(rec)) if (val && typeof val === "object") removeAttr(val, targetKey);
            };
            if (telemetryCopy && removeRow?.key) removeAttr(telemetryCopy, removeRow.key);
            const afterClone = telemetryCopy;
            tele.setParsed(afterClone);
            const previews = usePreviewStore.getState();
            const nextStep = previews.snapshots.length;
            previews.setSnapshots([...previews.snapshots, { stepIndex: nextStep, before: beforeClone, after: afterClone }]);
            previews.setStepIndex(nextStep);
            previews.setAutoJump(true);

            // Append OTTL equivalent
            const ottl = useOttlStore.getState();
            const quote = (s: string) => `"${s.replace(/"/g, '\\"')}"`;
            const stmt = `delete_key(attributes, ${quote(removeRow?.key ?? "")})`;
            const nextText = [ottl.text, `# auto: remove attribute`, stmt].filter(Boolean).join("\n").trim();
            ottl.setText(nextText);
            ottl.setLastCompiled(nextText);
          } catch {}
        }}
      />
    </section>
  );
}

function normalizeAttributes(attrs: unknown): Array<{ key: string; value: string }> {
  const out: Array<{ key: string; value: string }> = [];
  const list = Array.isArray(attrs) ? (attrs as AttributeKV[]) : [];
  for (const kv of list) {
    if (!kv || typeof kv !== "object" || typeof (kv as AttributeKV).key !== "string") continue;
    const key = (kv as AttributeKV).key;
    const v = (kv as AttributeKV).value;
    const value = v && typeof v === "object" ? stringifyFirst(v) : "";
    out.push({ key, value });
  }
  return out;
}

function stringifyFirst(v: Record<string, unknown>): string {
  const firstKey = Object.keys(v)[0];
  const val = firstKey ? v[firstKey] : undefined;
  try {
    if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") return String(val);
    if (val == null) return "";
    return JSON.stringify(val);
  } catch {
    return String(val ?? "");
  }
}


