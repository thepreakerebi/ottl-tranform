"use client";

import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../../components/ui/dialog";
import { Label } from "../../../components/ui/label";
import { Input } from "../../../components/ui/input";
import { Button } from "../../../components/ui/button";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  attributeKey: string;
  currentValue: string;
  onSubmit: (start: number, end: number | null, maskChar?: string) => void;
};

export default function MaskAttributeDialog({ open, onOpenChange, attributeKey, currentValue, onSubmit }: Props) {
  const [start, setStart] = useState("0");
  const [end, setEnd] = useState("");
  const [maskChar, setMaskChar] = useState("*");

  useEffect(() => {
    if (open) {
      setStart("0");
      setEnd("");
      setMaskChar("*");
    }
  }, [open]);

  const preview = useMemo(() => {
    const s = Number(start || 0);
    const e = end ? Number(end) : null;
    if (Number.isNaN(s) || (end && Number.isNaN(Number(end)))) return currentValue;
    const startIdx = Math.max(0, Math.min(currentValue.length, s));
    const endIdx = e == null ? currentValue.length : Math.max(startIdx, Math.min(currentValue.length, e));
    const maskLen = Math.max(0, endIdx - startIdx);
    const masked = maskLen > 0 ? maskChar.repeat(maskLen) : maskChar;
    const left = currentValue.slice(0, startIdx);
    const right = currentValue.slice(endIdx);
    return left + masked + right;
  }, [currentValue, start, end, maskChar]);

  const canSave = !Number.isNaN(Number(start || 0)) && (!end || !Number.isNaN(Number(end))) && attributeKey.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mask attribute</DialogTitle>
          <DialogDescription>Replace part of the attribute value with a mask character.</DialogDescription>
        </DialogHeader>
        <form id="mask-attr-form" className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (canSave) { onSubmit(Number(start || 0), end ? Number(end) : null, maskChar); onOpenChange(false); } }}>
          <section>
            <Label>Attribute key</Label>
            <p className="text-xs mt-1">{attributeKey}</p>
          </section>
          <section className="grid grid-cols-3 gap-2 items-end">
            <div>
              <Label htmlFor="mask-start">Start</Label>
              <Input id="mask-start" className="mt-1" value={start} onChange={(e) => setStart(e.target.value)} placeholder="0" />
            </div>
            <div>
              <Label htmlFor="mask-end">End (optional)</Label>
              <Input id="mask-end" className="mt-1" value={end} onChange={(e) => setEnd(e.target.value)} placeholder="e.g. 5" />
            </div>
            <div>
              <Label htmlFor="mask-char">Mask char</Label>
              <Input id="mask-char" className="mt-1" value={maskChar} onChange={(e) => setMaskChar(e.target.value.slice(0, 1))} placeholder="*" />
            </div>
          </section>
          <section>
            <Label>Preview</Label>
            <p className="text-xs mt-1 break-words">{preview}</p>
          </section>
        </form>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" form="mask-attr-form" disabled={!canSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


