import { useMutation } from "@tanstack/react-query";
import { invokeFunctionOrThrow } from "../invokeFunctionOrThrow";

export function useCreatePortalSession() {
  return useMutation({
    mutationFn: async () => {
      const { url } = await invokeFunctionOrThrow<{ url: string }>("create-portal-session");
      if (!url) throw new Error("No billing portal URL returned");
      return url;
    },
    onSuccess: (url) => {
      window.location.href = url;
    },
  });
}
