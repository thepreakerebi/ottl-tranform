"use client";

import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Separator } from "../../../components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";
import type { ConditionChain, ConditionChainClause, ConditionComparison } from "../../../lib/ottl/types";

type Props = {
  value: ConditionChain;
  onChange: (c: ConditionChain) => void;
};

export default function ConditionChainBuilder({ value, onChange }: Props) {
  return (
    <section className="space-y-3">
      <Label className="text-xs font-medium">Conditions</Label>
      {renderComparison(value.first, (next) => onChange({ ...value, first: next }))}
      {value.rest.map((clause, idx) => (
        <section key={idx} className="space-y-2">
          <section className="flex items-center gap-3">
            <Separator className="flex-1" />
            <Select value={clause.op} onValueChange={(v) => {
              const rest = value.rest.slice();
              rest[idx] = { ...clause, op: v as ConditionChainClause["op"] };
              onChange({ ...value, rest });
            }}>
              <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="AND">AND</SelectItem>
                <SelectItem value="OR">OR</SelectItem>
              </SelectContent>
            </Select>
            <Separator className="flex-1" />
          </section>
          {renderComparison(clause.expr, (next) => {
            const rest = value.rest.slice();
            rest[idx] = { ...clause, expr: next };
            onChange({ ...value, rest });
          })}
          <section className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => {
              const rest = value.rest.slice();
              rest.splice(idx, 1);
              onChange({ ...value, rest });
            }}>Remove</Button>
            {idx === value.rest.length - 1 && (
              <Button type="button" variant="outline" size="sm" onClick={() => {
                const rest = value.rest.slice();
                rest.splice(idx + 1, 0, { op: "AND", expr: emptyComparison() });
                onChange({ ...value, rest });
              }}>Add condition</Button>
            )}
          </section>
        </section>
      ))}
      {value.rest.length === 0 && (
        <Button type="button" variant="outline" size="sm" onClick={() => onChange({ ...value, rest: [{ op: "AND", expr: emptyComparison() }] })}>Add condition</Button>
      )}
      <p className="text-[11px] text-muted-foreground">Only items matching the expression will be affected.</p>
    </section>
  );
}

function renderComparison(cmp: ConditionComparison, onChange: (c: ConditionComparison) => void): React.ReactNode {
  return (
    <section className="space-y-2 w-full">
      <Input
        placeholder="Where (e.g. name, http.method, service.name)"
        value={cmp.attribute}
        onChange={(e) => onChange({ ...cmp, attribute: e.target.value })}
        className="w-full"
      />
      <section className="flex gap-2">
        <Select value={cmp.operator} onValueChange={(v) => onChange({ ...cmp, operator: v as ConditionComparison["operator"] })}>
          <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="eq">=</SelectItem>
            <SelectItem value="neq">≠</SelectItem>
            <SelectItem value="contains">contains</SelectItem>
            <SelectItem value="starts">starts with</SelectItem>
            <SelectItem value="regex">regex</SelectItem>
            <SelectItem value="exists">exists</SelectItem>
          </SelectContent>
        </Select>
        {cmp.operator !== "exists" && (
          <Input
            placeholder="Value"
            value={String(cmp.value ?? "")}
            onChange={(e) => onChange({ ...cmp, value: e.target.value })}
            className="flex-1"
          />
        )}
      </section>
    </section>
  );
}

function emptyComparison(): ConditionComparison {
  return { kind: "cmp", attribute: "", operator: "eq", value: "" };
}


