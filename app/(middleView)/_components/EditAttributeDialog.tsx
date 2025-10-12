"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../../components/ui/dialog";
import { Label } from "../../../components/ui/label";
import { Input } from "../../../components/ui/input";
import { Button } from "../../../components/ui/button";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialKey: string;
  initialValue: string;
  onSubmit: (nextKey: string, nextValue: string) => void;
};

export default function EditAttributeDialog({ open, onOpenChange, initialKey, initialValue, onSubmit }: Props) {
  const [keyName, setKeyName] = useState("");
  const [value, setValue] = useState("");

  useEffect(() => {
    if (open) {
      setKeyName(initialKey ?? "");
      setValue(initialValue ?? "");
    }
  }, [open, initialKey, initialValue]);

  const canSave = keyName.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit attribute</DialogTitle>
          <DialogDescription>Update the attribute key and value.</DialogDescription>
        </DialogHeader>
        <form id="edit-attr-form" className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (canSave) { onSubmit(keyName, value); onOpenChange(false); } }}>
          <section>
            <Label htmlFor="edit-attr-key">Attribute key</Label>
            <Input id="edit-attr-key" className="mt-1" value={keyName} onChange={(e) => setKeyName(e.target.value)} />
          </section>
          <section>
            <Label htmlFor="edit-attr-value">Attribute value</Label>
            <Input id="edit-attr-value" className="mt-1" value={value} onChange={(e) => setValue(e.target.value)} />
          </section>
        </form>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" form="edit-attr-form" disabled={!canSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


