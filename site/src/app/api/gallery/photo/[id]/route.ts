import { GetObjectCommand } from "@aws-sdk/client-s3";
import { bucketName, readManifest, s3 } from "@/lib/gallery";

export const runtime = "nodejs";

/**
 * Proxy an image out of the private bucket. We look the id up in the manifest
 * to recover its object key (the extension varies by original type, so it isn't
 * derivable from the id alone), stream the bytes back, and cache hard: ids are
 * UUIDs and content never changes under a given key, so it's immutable.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const item = (await readManifest()).find((i) => i.id === id);
  if (!item) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const res = await s3().send(
      new GetObjectCommand({ Bucket: bucketName(), Key: item.key }),
    );
    const stream = res.Body?.transformToWebStream();
    if (!stream) return new Response("Not found", { status: 404 });
    const headers: Record<string, string> = {
      "Content-Type": res.ContentType ?? "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable",
    };
    if (res.ContentLength != null) {
      headers["Content-Length"] = String(res.ContentLength);
    }
    return new Response(stream, { headers });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
