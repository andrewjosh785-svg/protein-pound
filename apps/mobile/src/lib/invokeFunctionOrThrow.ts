// mirrors apps/web/src/lib/invokeFunctionOrThrow.ts
import { supabase } from "./supabaseClient";

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
