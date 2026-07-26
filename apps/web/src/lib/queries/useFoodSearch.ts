// mirrors apps/mobile/src/lib/queries/useFoodSearch.ts
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { searchFoodByName, type FoodSearchResult } from "../openFoodFacts";

const MIN_QUERY_LENGTH = 3;
const DEBOUNCE_MS = 400;

export function useFoodSearch(query: string) {
  const [debounced, setDebounced] = useState(query);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  return useQuery<FoodSearchResult[]>({
    queryKey: ["food-search", debounced],
    queryFn: () => searchFoodByName(debounced.trim()),
    enabled: debounced.trim().length >= MIN_QUERY_LENGTH,
    staleTime: 5 * 60 * 1000,
  });
}
