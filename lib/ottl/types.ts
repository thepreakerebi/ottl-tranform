// Shared types for OTTL blocks, compilation, and preview/diff data

export type SignalType = "traces" | "metrics" | "logs" | "unknown";

export type BlockType =
  | "addAttribute"
  | "removeAttribute"
  | "renameAttribute"
  | "maskAttribute"
  | "editParentChild" // traces
  | "editTraceOrSpanId" // traces
  | "renameMetric" // metrics
  | "editMetricValue" // metrics
  | "unitConversion" // metrics
  | "aggregateSeries" // metrics
  | "editLabels" // metrics
  | "renameLogField" // logs
  | "maskLogField" // logs
  | "rawOttl"; // advanced

export type JSONObject = { [key: string]: JSONValue };
export type JSONArray = JSONValue[];
export type JSONValue = string | number | boolean | null | JSONObject | JSONArray;

export interface BlockBase {
  id: string;
  type: BlockType;
  signal: "general" | SignalType;
  config: Record<string, unknown>;
  enabled: boolean;
  errors?: string[];
}

export type Block = BlockBase;

export interface CompileResult {
  traceStatements: string[];
  metricStatements: string[];
  logStatements: string[];
}

export interface DiffChange {
  path: Array<string | number>;
  type: "added" | "removed" | "modified";
  before?: JSONValue;
  after?: JSONValue;
}

export interface Snapshot {
  stepIndex: number;
  before: JSONValue | null;
  after: JSONValue | null;
}

export interface TransformRequest {
  telemetry: JSONValue;
  ottl?: string;
  blocks?: Block[];
}

export interface TransformResponse {
  transformed: JSONValue;
  info?: string;
}

// Condition expression tree used by conditional scopes/filters
export type ConditionOperator =
  | "eq" // equals
  | "neq" // not equals
  | "contains"
  | "starts"
  | "regex"
  | "exists";

export type AttributePath = string; // dot or bracket path, e.g. "service.name" or "resource.attributes['http.method']"

export type ConditionNode = ConditionGroup | ConditionComparison;

export interface ConditionGroup {
  kind: "group";
  op: "AND" | "OR";
  not?: boolean;
  children: ConditionNode[];
}

export interface ConditionComparison {
  kind: "cmp";
  attribute: AttributePath;
  operator: ConditionOperator;
  // When operator requires a value (not exists), this is provided
  value?: JSONValue;
}

