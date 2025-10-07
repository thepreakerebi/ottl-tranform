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

export type GroupTitle = "General" | "Traces" | "Logs" | "Metrics";

export function groupTitleToSignal(groupTitle: GroupTitle): "general" | "traces" | "metrics" | "logs" {
  if (groupTitle === "Traces") return "traces";
  if (groupTitle === "Metrics") return "metrics";
  if (groupTitle === "Logs") return "logs";
  return "general";
}

export const typeToDescription: Record<string, string> = {
  addAttribute: "Add a new key-value to the data",
  removeAttribute: "Remove one or more attributes",
  renameAttribute: "Rename an attribute key",
  maskAttribute: "Mask an attribute value",
  editParentChild: "Change span parent/child relations",
  editTraceOrSpanId: "Modify or randomize trace/span IDs",
  renameLogField: "Rename a log field",
  maskLogField: "Mask a log field",
  unitConversion: "Convert metric units",
  aggregateSeries: "Aggregate metric datapoints",
  editLabels: "Rename, remove, or change labels",
};


