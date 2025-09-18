import { useState } from "react";
import { apiClient, ApiError } from "../utils/apiClient";
import { tokenClient } from "../utils/tokenClient";

interface LoginResult {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiry: string;
}

interface OAuthLoginRequest {
  code: string;
  redirectUri: string;
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

  const oAuthLogin = async (oAuthData: OAuthLoginRequest) => {
    try {
      // Exchange authorization code for tokens
      const loginResult = await apiClient.post<LoginResult>(
        "/auth/google/exchange",  // Backend endpoint for Google code exchange
        JSON.stringify(oAuthData),
        true
      );

      tokenClient.setToken(loginResult.accessToken);
      localStorage.setItem('refreshToken', loginResult.refreshToken);
      setLoginError("");
      return true;
    } catch (error) {
      if (error instanceof ApiError) {
        setLoginError(error.problemDetails.title);
      } else {
        setLoginError("OAuth code exchange failed");
      }
      return false;
    }
  };

  return { login, oAuthLogin, loginError };
};

export default useAuth;
