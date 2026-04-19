// src/lib/fn-error.ts
//
// ME-04 from 04-REVIEW.md: shared helper for extracting the structured
// error body from supabase-js FunctionsHttpError responses. Previously
// duplicated across 9 admin hooks (useCreatePoll, useUpdatePoll, etc.);
// extracting here so a bug fix only has to land in one place.
//
// The supabase-js v2 client attaches a `context` object to
// FunctionsHttpError with `status` and an async `json()` reader. If the
// Edge Function returned `{ error: "..." }`, we surface that message.
// If the body is not valid JSON or the reader throws mid-read, we fall
// through to the caller-provided fallback without masking the original
// HTTP status.

type FunctionErrorContext = {
  status?: number
  json?: () => Promise<{ error?: string }>
}

type FunctionErrorLike = {
  context?: FunctionErrorContext
}

export async function extractFunctionError(
  error: unknown,
  fallback: string,
): Promise<{ msg: string; status: number | undefined }> {
  let status: number | undefined
  let msg = fallback
  try {
    const ctx = (error as FunctionErrorLike)?.context
    status = ctx?.status
    if (ctx?.json) {
      const body = await ctx.json()
      if (body?.error) msg = body.error
    }
  } catch {
    /* fall through to fallback message; status is preserved */
  }
  return { msg, status }
}

// Convenience wrapper for callers that only need the message string.
export async function extractFunctionErrorMessage(
  error: unknown,
  fallback: string,
): Promise<string> {
  const { msg } = await extractFunctionError(error, fallback)
  return msg
}
