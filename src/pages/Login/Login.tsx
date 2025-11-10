import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import useAuth from "../../hooks/useAuth";
import GoogleOAuthButton from "../../components/GoogleOAuthButton/GoogleOAuthButton";
import FacebookOAuthButton from "../../components/FacebookOAuthButton/FacebookOAuthButton";
import "./Login.css";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { login, startExternalLogin, loginError } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    try {
      if (await login(email, password)) {
        navigate("/");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleExternalLogin = (provider: "google" | "facebook") => {
    setIsLoading(true);
    const redirectUrl = `${window.location.origin}/`;
    const didStart = startExternalLogin(provider, redirectUrl);
    if (!didStart) {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-form">
        <h2>Sign in to Intellishelf</h2>
        
        {/* OAuth Login Section */}
        <div className="oauth-section">
          <GoogleOAuthButton
            onClick={() => handleExternalLogin("google")}
            disabled={isLoading}
          />

          <FacebookOAuthButton
            onClick={() => handleExternalLogin("facebook")}
            disabled={isLoading}
          />
        </div>

        {/* Divider */}
        <div className="login-divider">
          <span>or</span>
        </div>

        {/* Email/Password Login Form */}
        <form onSubmit={handleLogin} className="email-login-form">
          <div>
            <label htmlFor="email">Email:</label>
            <input
              type="email"
              id="email"
              name="email"
              className="login-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              required
            />
          </div>

          <div>
            <label htmlFor="password">Password:</label>
            <input
              type="password"
              id="password"
              name="password"
              className="login-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              required
            />
          </div>
          
          <button 
            type="submit" 
            className="login-button" 
            disabled={isLoading}
          >
            {isLoading ? "Signing in..." : "Sign in with Email"}
          </button>
        </form>

        {loginError && <p className="login-error">{loginError}</p>}
      </div>
    </div>
  );
};

export default Login;
