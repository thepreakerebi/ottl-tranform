import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { telemetry, ottl, blocks } = await request.json();

    // Placeholder: server transform not implemented in MVP.
    // Client should simulate transforms in a Web Worker for responsiveness.
    return NextResponse.json({
      transformed: telemetry,
      info: "Server transform is a stub in MVP; use client worker.",
      received: {
        hasOttl: Boolean(ottl && typeof ottl === "string" && ottl.length > 0),
        hasBlocks: Array.isArray(blocks) ? blocks.length : 0,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}


