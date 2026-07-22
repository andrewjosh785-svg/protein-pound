import { supabase } from "./supabaseClient";

/** Calls a Supabase Edge Function and throws with the function's own { error: string }
 * body when present, since FunctionsHttpError only exposes that on the raw `.context`
 * Response rather than surfacing it directly. */
export async function invokeFunctionOrThrow<T>(name: string, body?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });

  if (error) {
    const context = (error as { context?: Response }).context;
    if (context) {
      try {
        const errorBody = await context.json();
        throw new Error(errorBody?.error || error.message);
      } catch {
        throw new Error(error.message);
      }
    }
    throw new Error(error.message);
  }

  return data as T;
}
