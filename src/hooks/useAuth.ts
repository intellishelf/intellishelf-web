import { useState } from "react";
import { useNavigate } from "react-router-dom";

const useAuth = () => {
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const login = async (userName: string, password: string) => {
    const response = await fetch(
      `${process.env.REACT_APP_API_URL}/api/auth/login`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userName, password }),
      }
    );

    if (response.ok) {
      const data = await response.json();
      localStorage.setItem("token", data.token);
      navigate("/"); // Redirect to home
    } else {
      setError("Login failed");
    }
  };

  return { login, error };
};

export default useAuth;
