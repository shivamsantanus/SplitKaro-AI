import { useQuery } from "@tanstack/react-query"

async function fetchGroupDetail(groupId: string) {
  const res = await fetch(`/api/groups/${groupId}`)
  if (res.status === 403 || res.status === 404) throw new Error("NOT_FOUND")
  if (!res.ok) throw new Error("Failed to fetch group")
  return res.json()
}

export function useGroupDetailQuery(groupId: string | null) {
  return useQuery({
    queryKey: ["group", groupId],
    queryFn: () => fetchGroupDetail(groupId!),
    enabled: !!groupId,
    staleTime: 30_000,
  })
}
