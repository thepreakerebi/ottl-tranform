"use client";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../../components/ui/dialog";
import { Button } from "../../../components/ui/button";
import { Label } from "../../../components/ui/label";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  attributeKey: string;
  onConfirm: () => void;
};

export default function RemoveAttributeDialog({ open, onOpenChange, attributeKey, onConfirm }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove attribute</DialogTitle>
          <DialogDescription>Are you sure you want to remove this attribute?</DialogDescription>
        </DialogHeader>
        <section className="space-y-2">
          <Label>Attribute key</Label>
          <p className="text-xs">{attributeKey}</p>
        </section>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" variant="destructive" onClick={() => { onConfirm(); onOpenChange(false); }}>Remove</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


