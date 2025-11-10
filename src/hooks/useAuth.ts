import { useMemo, useState } from "react";
import { apiClient, ApiError } from "../utils/apiClient";

type ExternalProvider = "google" | "facebook";

const useAuth = () => {
  const [loginError, setLoginError] = useState<string | undefined>("");

  const apiBase = useMemo(() => {
    const baseUrl = process.env.REACT_APP_API_URL ?? "";
    return baseUrl.replace(/\/$/, "");
  }, []);

  const login = async (email: string, password: string) => {
    try {
      await apiClient.post<void>(
        "/auth/login",
        JSON.stringify({ email, password })
      );

      setLoginError("");
      return true;
    } catch (error) {
      if (error instanceof ApiError) {
        setLoginError(error.problemDetails.title);
      } else {
        setLoginError("An unexpected error occurred");
      }
      return false;
    }
  };

  const startExternalLogin = (provider: ExternalProvider, returnPath = "/") => {
    if (!apiBase) {
      console.error("REACT_APP_API_URL is not configured");
      return false;
    }

    try {
      const target = new URL(`${apiBase}/auth/${provider}`);
      target.searchParams.set("returnUrl", returnPath);
      window.location.href = target.toString();
      return true;
    } catch (error) {
      console.error(`Failed to initiate ${provider} login`, error);
      return false;
    }
  };

  const logout = async () => {
    try {
      await apiClient.post<void>("/auth/logout");
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  return {
    login,
    startExternalLogin,
    logout,
    loginError,
  };
};

export default useAuth;
