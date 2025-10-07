import { NextRequest, NextResponse } from "next/server";

type Signal = "traces" | "metrics" | "logs" | "unknown";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function detectFromObject(obj: Record<string, unknown>): Signal {
  // OTLP JSON heuristics
  if (
    "resourceSpans" in obj ||
    "scopeSpans" in obj ||
    "spans" in obj ||
    "spanId" in obj ||
    "traceId" in obj
  ) {
    return "traces";
  }
  if (
    "resourceMetrics" in obj ||
    "scopeMetrics" in obj ||
    "metrics" in obj ||
    "dataPoints" in obj ||
    "gauge" in obj ||
    "sum" in obj ||
    "histogram" in obj
  ) {
    return "metrics";
  }
  if (
    "resourceLogs" in obj ||
    "scopeLogs" in obj ||
    "logs" in obj ||
    "logRecords" in obj ||
    "body" in obj
  ) {
    return "logs";
  }
  return "unknown";
}

function detectSignal(payload: unknown): Signal {
  if (Array.isArray(payload)) {
    for (const item of payload) {
      if (isObject(item)) {
        const detected = detectFromObject(item);
        if (detected !== "unknown") return detected;
      }
    }
    return "unknown";
  }
  if (isObject(payload)) {
    return detectFromObject(payload);
  }
  return "unknown";
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => undefined);
    const signal = detectSignal(body);
    return NextResponse.json({ signal });
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON payload" },
      { status: 400 }
    );
  }
}


