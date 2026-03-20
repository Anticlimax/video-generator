import { runJob } from "./run-job.js";

export async function createJob(options = {}) {
  const {
    store,
    input,
    runJobImpl = runJob,
    onBackgroundError = () => {}
  } = options;

  const job = await store.create(input);
  const runPromise = new Promise((resolve) => {
    setTimeout(() => {
      Promise.resolve(runJobImpl({ jobId: job.id, store }))
        .then(resolve)
        .catch(async (error) => {
          onBackgroundError(error, job);
          const current = await store.getById(job.id);
          if (current && current.status !== "failed" && current.status !== "completed") {
            resolve(
              await store.update(job.id, {
                status: "failed",
                stage: "failed",
                errorCode: String(error?.message || "job_run_failed").trim() || "job_run_failed",
                errorMessage: String(error?.message || "job_run_failed").trim() || "job_run_failed"
              })
            );
            return;
          }
          resolve(current);
        });
    }, 0);
  });

  return {
    job,
    runPromise
  };
}
