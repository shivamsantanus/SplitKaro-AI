import { useQuery } from "@tanstack/react-query"

async function fetchGroups(archived: boolean) {
  const res = await fetch(`/api/groups${archived ? "?archived=true" : ""}`)
  if (!res.ok) throw new Error("Failed to fetch groups")
  return res.json()
}

export function useGroupsQuery(archived = false) {
  return useQuery({
    queryKey: ["groups", { archived }],
    queryFn: () => fetchGroups(archived),
    staleTime: 30_000,
  })
}
