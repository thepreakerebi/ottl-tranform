"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../../../components/ui/dialog";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Button } from "../../../components/ui/button";
import { RadioGroup, RadioGroupItem } from "../../../components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  targetTitle: string; // e.g., "Resource" or "Scope: name@version"
  onSubmit: (payload: {
    key: string;
    mode: "literal" | "substring";
    value?: string; // for literal
    literalType?: "string" | "number" | "boolean";
    sourceAttr?: string; // for substring
    substringStart?: number;
    substringEnd?: number | null;
  }) => void;
};

export default function AddAttributeDialog({ open, onOpenChange, targetTitle, onSubmit }: Props) {
  const [keyName, setKeyName] = useState("");
  const [value, setValue] = useState("");
  const [mode, setMode] = useState<"literal" | "substring">("literal");
  const [literalType, setLiteralType] = useState<"string" | "number" | "boolean">("string");
  const [sourceAttr, setSourceAttr] = useState("");
  const [substringStart, setSubstringStart] = useState("0");
  const [substringEnd, setSubstringEnd] = useState("");

  useEffect(() => {
    if (open) {
      setKeyName("");
      setValue("");
      setMode("literal");
      setLiteralType("string");
      setSourceAttr("");
      setSubstringStart("0");
      setSubstringEnd("");
    }
  }, [open]);

  const canSave = keyName.trim().length > 0;

  function handleSave() {
    const payload =
      mode === "literal"
        ? { key: keyName, mode, value, literalType }
        : {
            key: keyName,
            mode,
            sourceAttr,
            substringStart: Number(substringStart || 0),
            substringEnd: substringEnd ? Number(substringEnd) : null,
          };
    onSubmit(payload);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add attribute to {targetTitle}</DialogTitle>
          <DialogDescription>Provide an attribute key and value to add.</DialogDescription>
        </DialogHeader>
        <form id="add-attr-form" className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (canSave) handleSave(); }}>
          <section>
            <Label htmlFor="add-attr-key">Attribute key</Label>
            <Input id="add-attr-key" className="mt-1" value={keyName} onChange={(e) => setKeyName(e.target.value)} placeholder="e.g. service.env" />
          </section>
          <section className="space-y-2">
            <Label>Attribute value</Label>
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as "literal" | "substring")} className="flex items-center gap-3 text-sm">
              <section className="flex items-center gap-2">
                <RadioGroupItem id="dlg-mode-literal" value="literal" />
                <Label htmlFor="dlg-mode-literal">Literal</Label>
              </section>
              <section className="flex items-center gap-2">
                <RadioGroupItem id="dlg-mode-substring" value="substring" />
                <Label htmlFor="dlg-mode-substring">Substring of attribute</Label>
              </section>
            </RadioGroup>
            {mode === "literal" && (
              <section className="flex items-center gap-2">
                <Select value={literalType} onValueChange={(v) => setLiteralType(v as "string" | "number" | "boolean") }>
                  <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="string">string</SelectItem>
                    <SelectItem value="number">number</SelectItem>
                    <SelectItem value="boolean">boolean</SelectItem>
                  </SelectContent>
                </Select>
                <Input className="flex-1 min-w-0" value={value} onChange={(e) => setValue(e.target.value)} placeholder="e.g. prod" />
              </section>
            )}
            {mode === "substring" && (
              <section className="space-y-2">
                <Input className="mt-1" value={sourceAttr} onChange={(e) => setSourceAttr(e.target.value)} placeholder="Source attribute key (e.g. http.url)" />
                <section className="flex items-center gap-2">
                  <Input className="w-24" value={substringStart} onChange={(e) => setSubstringStart(e.target.value)} placeholder="start" />
                  <Input className="w-28" value={substringEnd} onChange={(e) => setSubstringEnd(e.target.value)} placeholder="end (optional)" />
                </section>
              </section>
            )}
          </section>
        </form>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" form="add-attr-form" disabled={!canSave}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


