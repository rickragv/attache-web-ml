/**
 * Declarative stage-graph runner for inference pipelines.
 *
 * A stage: { id, label, optional, run(ctx) }.
 *  - ctx is a shared mutable bag; stages read what earlier stages wrote.
 *  - optional stages that throw are recorded and skipped (honest
 *    degradation); required stages abort the pipeline.
 *  - every stage's wall time and status land in trace[], which feeds the
 *    pipeline inspector UI and telemetry — the runner is the single source
 *    of truth for "what actually executed".
 */
export async function runPipeline(stages, ctx, { onStage } = {}) {
  const trace = []
  for (const stage of stages) {
    if (stage.when && !stage.when(ctx)) {
      trace.push({ id: stage.id, label: stage.label, status: 'skipped', ms: 0 })
      continue
    }
    const t0 = performance.now()
    onStage?.({ id: stage.id, label: stage.label, status: 'running' })
    try {
      await stage.run(ctx)
      const entry = {
        id: stage.id,
        label: stage.label,
        status: 'done',
        ms: performance.now() - t0,
        detail: ctx.stageDetail?.[stage.id] ?? null,
      }
      trace.push(entry)
      onStage?.(entry)
      if (ctx.halt) break
    } catch (err) {
      const entry = {
        id: stage.id,
        label: stage.label,
        status: stage.optional ? 'failed-skipped' : 'failed',
        ms: performance.now() - t0,
        detail: String(err?.message ?? err),
      }
      trace.push(entry)
      onStage?.(entry)
      if (!stage.optional) throw Object.assign(err, { trace })
    }
  }
  ctx.trace = trace
  return ctx
}
