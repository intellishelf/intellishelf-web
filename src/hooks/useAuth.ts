import { useState } from "react";
import { apiClient, ApiError } from "../utils/apiClient";
import { tokenClient } from "../utils/tokenClient";

interface LoginResult {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiry: string;
}

const useAuth = () => {
  const [loginError, setLoginError] = useState<string | undefined>("");

  const login = async (email: string, password: string) => {
    try {
      const loginResult = await apiClient.post<LoginResult>(
        "/auth/login",
        JSON.stringify({ email, password }),
        true
      );

      tokenClient.setToken(loginResult.accessToken);
      // Store refresh token if needed later
      localStorage.setItem('refreshToken', loginResult.refreshToken);
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

  return { login, loginError };
};

export default useAuth;
