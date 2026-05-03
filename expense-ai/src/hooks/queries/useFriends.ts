import { useQuery } from "@tanstack/react-query"

async function fetchFriends() {
  const res = await fetch("/api/friends")
  if (!res.ok) throw new Error("Failed to fetch friends")
  return res.json()
}

export function useFriendsQuery(enabled = true) {
  return useQuery({
    queryKey: ["friends"],
    queryFn: fetchFriends,
    enabled,
    staleTime: 60_000,
  })
}
