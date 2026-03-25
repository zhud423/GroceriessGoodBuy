"use client"

import {
  useQuery,
  type UseQueryOptions,
  type UseQueryResult
} from "@tanstack/react-query"

import { useAuth } from "@/src/providers/auth-provider"

type QueryKey = readonly unknown[]

export function useAuthedQuery<TData, TError = Error>({
  queryKey,
  queryFn,
  enabled = true,
  ...options
}: Omit<UseQueryOptions<TData, TError, TData, QueryKey>, "queryKey" | "queryFn"> & {
  queryKey: QueryKey
  queryFn: (accessToken: string) => Promise<TData>
}) {
  const auth = useAuth()

  return useQuery({
    ...options,
    queryKey: [...queryKey, auth.user?.id] as QueryKey,
    enabled: enabled && auth.isAuthenticated && Boolean(auth.accessToken),
    queryFn: () => queryFn(auth.accessToken!)
  }) as UseQueryResult<TData, TError>
}
