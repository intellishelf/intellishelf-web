import { tokenClient } from "./tokenClient";

export interface BaseApiResponse {
  isSuccess: boolean;
  error?: string;
}

export interface ApiResponse<T> extends BaseApiResponse {
  data?: T;
}

async function call<T>(
  url: string,
  method: string,
  body?: string | FormData,
  withoutToken?: boolean
): Promise<ApiResponse<T>> {
  const token = tokenClient.getToken();
  if (!token && !withoutToken) {
    window.location.href = "/login";
    return { error: "Token not found", isSuccess: false };
  }

  const headers = {
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(typeof body === "string" ? { "Content-Type": "application/json" } : {}),
  };

  try {
    const result = await fetch(process.env.REACT_APP_API_URL + url, {
      method,
      body,
      headers,
    });

    if (result.ok) {
      return {
        isSuccess: true,
        data: result.status === 204 ? null : await result.json(),
      };
    }

    return {
      isSuccess: false,
      error: result.statusText || "Request failed",
    };
  } catch (err) {
    return {
      isSuccess: false,
      error: err instanceof Error ? err.message : "Unknown error occurred",
    };
  }
}

export const apiClient = {
  get: <T>(url: string) => call<T>(url, "GET"),
  post: <T>(url: string, body: string | FormData, withoutToken?: boolean) =>
    call<T>(url, "POST", body, withoutToken),
  delete: (url: string) => call(url, "DELETE") as Promise<BaseApiResponse>,
};
