import { tokenClient } from "./tokenClient";

export interface ProblemDetails {
  title: string;
  status: number;
  type: string;
  detail?: string;
  instance?: string;
}

export class ApiError extends Error {
  constructor(public problemDetails: ProblemDetails, public statusCode: number) {
    super(problemDetails.title);
    this.name = 'ApiError';
  }
}

async function call<T>(
  url: string,
  method: string,
  body?: string | FormData,
  withoutToken?: boolean
): Promise<T> {
  const token = tokenClient.getToken();
  if (!token && !withoutToken) {
    window.location.href = "/login";
    throw new ApiError(
      { title: "Token not found", status: 401, type: "Unauthorized" },
      401
    );
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
      // Return the actual content directly
      return result.status === 204 ? (null as T) : await result.json();
    }

    // Handle error response - parse ProblemDetails
    let problemDetails: ProblemDetails;
    try {
      problemDetails = await result.json() as ProblemDetails;
    } catch {
      // Fallback if response is not JSON
      problemDetails = {
        title: result.statusText || "Request failed",
        status: result.status,
        type: "UnknownError"
      };
    }

    throw new ApiError(problemDetails, result.status);
  } catch (err) {
    if (err instanceof ApiError) {
      throw err; // Re-throw ApiError as-is
    }
    
    // Network or other errors
    throw new ApiError(
      {
        title: err instanceof Error ? err.message : "Unknown error occurred",
        status: 500,
        type: "NetworkError"
      },
      500
    );
  }
}

export const apiClient = {
  get: <T>(url: string) => call<T>(url, "GET"),
  post: <T>(url: string, body: string | FormData, withoutToken?: boolean) =>
    call<T>(url, "POST", body, withoutToken),
  put: <T>(url: string, body: string | FormData) =>
    call<T>(url, "PUT", body),
  delete: <T>(url: string) => call<T>(url, "DELETE"),
};
