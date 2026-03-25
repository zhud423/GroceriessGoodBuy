"use client"

import {
  useMutation,
  type UseMutationOptions,
  type UseMutationResult
} from "@tanstack/react-query"

import { useAuth } from "@/src/providers/auth-provider"

export function useAuthedMutation<
  TData,
  TVariables = void,
  TError = Error,
  TContext = unknown
>({
  mutationFn,
  ...options
}: Omit<UseMutationOptions<TData, TError, TVariables, TContext>, "mutationFn"> & {
  mutationFn: (accessToken: string, variables: TVariables) => Promise<TData>
}) {
  const auth = useAuth()

  return useMutation({
    ...options,
    mutationFn: (variables) => {
      const accessToken = auth.accessToken

      if (!accessToken) {
        throw new Error("当前登录态不可用，请重新登录后再试。")
      }

      return mutationFn(accessToken, variables)
    }
  }) as UseMutationResult<TData, TError, TVariables, TContext>
}
