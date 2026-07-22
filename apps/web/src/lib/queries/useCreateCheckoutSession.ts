import { useMutation } from "@tanstack/react-query";
import { invokeFunctionOrThrow } from "../invokeFunctionOrThrow";

export function useCreateCheckoutSession() {
  return useMutation({
    mutationFn: async () => {
      const { url } = await invokeFunctionOrThrow<{ url: string }>("create-checkout-session");
      if (!url) throw new Error("No checkout URL returned");
      return url;
    },
    onSuccess: (url) => {
      window.location.href = url;
    },
  });
}
