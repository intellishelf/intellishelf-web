import { useState } from "react";
import { apiClient } from "../utils/apiClient";
import { tokenClient } from "../utils/tokenClient";

const useAuth = () => {
  const [loginError, setLoginError] = useState<string | undefined>("");

  const login = async (userName: string, password: string) => {
    const response = await apiClient.post<{ token: string }>(
      "/api/auth/login",
      JSON.stringify({ userName, password }),
      true
    );

    if (response.isSuccess && response.data) {
      tokenClient.setToken(response.data.token);
      return true;
    }

    setLoginError(response.error);
    return false;
  };

  return { login, loginError };
};

export default useAuth;
