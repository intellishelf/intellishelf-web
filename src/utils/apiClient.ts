import { tokenClient } from "./tokenClient";

export interface ApiResponse<T> {
  data?: T;
  isSuccess: boolean;
  error?: string;
}

const handleError = (err: unknown): ApiResponse<never> => ({
  isSuccess: false,
  error: err instanceof Error ? err.message : "Unknown error occurred",
});

const handleResponse = async <T>(result: Response): Promise<ApiResponse<T>> => {
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
};

const getHeaders = (token: string | null, body?: string | FormData) => {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (typeof body === "string") {
    headers["Content-Type"] = "application/json";
  }

  return headers;
};

const validateToken = (withoutToken?: boolean): string | null => {
  const token = tokenClient.getToken();

  if (!token && !withoutToken) {
    window.location.href = "/login";
    return null;
  }

  return token;
};

const call = async <T>(
  url: string,
  method: string,
  body?: string | FormData,
  withoutToken?: boolean
): Promise<ApiResponse<T>> => {
  const token = validateToken(withoutToken);
  if (!token && !withoutToken) {
    return { error: "Token not found", isSuccess: false };
  }

  try {
    const result = await fetch(process.env.REACT_APP_API_URL + url, {
      method,
      body,
      headers: getHeaders(token, body),
    });

    return handleResponse<T>(result);
  } catch (err) {
    return handleError(err);
  }
};

export const apiClient = {
  get: <T>(url: string) => call<T>(url, "GET"),
  post: <T>(url: string, body: string | FormData, withoutToken?: boolean) =>
    call<T>(url, "POST", body, withoutToken),
  delete: <T>(url: string) => call<T>(url, "DELETE"),
};
