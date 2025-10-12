"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../../../components/ui/dialog";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Button } from "../../../components/ui/button";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  targetTitle: string; // e.g., "Resource" or "Scope: name@version"
  onSubmit: (key: string, value: string) => void;
};

export default function AddAttributeDialog({ open, onOpenChange, targetTitle, onSubmit }: Props) {
  const [keyName, setKeyName] = useState("");
  const [value, setValue] = useState("");

  useEffect(() => {
    if (open) {
      setKeyName("");
      setValue("");
    }
  }, [open]);

  const canSave = keyName.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add attribute to {targetTitle}</DialogTitle>
          <DialogDescription>Provide an attribute key and value to add.</DialogDescription>
        </DialogHeader>
        <section className="space-y-3">
          <section>
            <Label htmlFor="add-attr-key">Attribute key</Label>
            <Input id="add-attr-key" value={keyName} onChange={(e) => setKeyName(e.target.value)} placeholder="e.g. service.env" />
          </section>
          <section>
            <Label htmlFor="add-attr-value">Attribute value</Label>
            <Input id="add-attr-value" value={value} onChange={(e) => setValue(e.target.value)} placeholder="e.g. prod" />
          </section>
        </section>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" disabled={!canSave} onClick={() => { onSubmit(keyName, value); onOpenChange(false); }}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


