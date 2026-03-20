import fs from "node:fs/promises";
import path from "node:path";

import { createJobStore } from "../../../../../../src/core/jobs/job-store.js";

const store = createJobStore({
  rootDir: path.join(process.cwd(), "jobs")
});

function resolveArtifactPath(job, kind) {
  if (kind === "video-image") {
    return job.videoImagePath || null;
  }
  if (kind === "cover") {
    return job.coverImagePath || null;
  }
  if (kind === "video") {
    return job.finalVideoPath || null;
  }
  return null;
}

function resolveContentType(kind, filePath) {
  if (kind === "video-image") {
    return "image/png";
  }
  if (kind === "cover") {
    return "image/png";
  }
  if (kind === "video") {
    return "video/mp4";
  }

  if (String(filePath).toLowerCase().endsWith(".png")) {
    return "image/png";
  }
  if (String(filePath).toLowerCase().endsWith(".mp4")) {
    return "video/mp4";
  }
  return "application/octet-stream";
}

export async function GET(
  _request: Request,
  context: { params: { id: string; kind: string } }
) {
  const job = await store.getById(context.params.id);
  if (!job) {
    return Response.json({ error: "job_not_found" }, { status: 404 });
  }

  const artifactPath = resolveArtifactPath(job, context.params.kind);
  if (!artifactPath) {
    return Response.json({ error: "artifact_not_found" }, { status: 404 });
  }

  const absolutePath = path.isAbsolute(artifactPath)
    ? artifactPath
    : path.join(process.cwd(), artifactPath);

  let fileBuffer;
  try {
    fileBuffer = await fs.readFile(absolutePath);
  } catch {
    return Response.json({ error: "artifact_not_found" }, { status: 404 });
  }

  return new Response(fileBuffer, {
    status: 200,
    headers: {
      "content-type": resolveContentType(context.params.kind, artifactPath),
      "cache-control": "no-store"
    }
  });
}
