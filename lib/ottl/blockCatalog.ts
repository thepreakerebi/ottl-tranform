export const labelToType: Record<string, string> = {
  "Add attribute": "addAttribute",
  "Remove attribute": "removeAttribute",
  "Rename attribute": "renameAttribute",
  "Mask attribute": "maskAttribute",
  "Edit parent/child": "editParentChild",
  "Edit trace/span ID": "editTraceOrSpanId",
  "Rename field": "renameLogField",
  "Mask field": "maskLogField",
  "Unit conversion": "unitConversion",
  "Aggregate series": "aggregateSeries",
  "Edit labels": "editLabels",
};

export function groupTitleToSignal(groupTitle: string) {
  if (groupTitle === "Traces") return "traces";
  if (groupTitle === "Metrics") return "metrics";
  if (groupTitle === "Logs") return "logs";
  return "general";
}


