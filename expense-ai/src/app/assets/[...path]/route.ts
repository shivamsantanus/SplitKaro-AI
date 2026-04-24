import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ASSET_ROOT = path.join(process.cwd(), "assets");

const CONTENT_TYPES: Record<string, string> = {
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

function normalizeSegments(value: string | string[] | undefined) {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function resolveAssetPath(segments: string[]) {
  const resolvedPath = path.resolve(ASSET_ROOT, ...segments);
  const rootPrefix = ASSET_ROOT.endsWith(path.sep) ? ASSET_ROOT : `${ASSET_ROOT}${path.sep}`;

  if (!resolvedPath.startsWith(rootPrefix)) {
    return null;
  }

  return resolvedPath;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path?: string | string[] }> }
) {
  const { path: assetPath } = await params;
  const segments = normalizeSegments(assetPath);

  if (segments.length === 0) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const resolvedPath = resolveAssetPath(segments);

  if (!resolvedPath) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  try {
    const file = await fs.readFile(resolvedPath);
    const ext = path.extname(resolvedPath).toLowerCase();
    const contentType = CONTENT_TYPES[ext] ?? "application/octet-stream";

    return new Response(file, {
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Type": contentType,
      },
    });
  } catch {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }
}
