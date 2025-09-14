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
  const { login, oAuthLogin, loginError } = useAuth();
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

  const handleOAuthSuccess = async (oAuthData: any) => {
    setIsLoading(true);
    try {
      if (await oAuthLogin(oAuthData)) {
        navigate("/");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuthError = (error: any) => {
    console.error("OAuth login error:", error);
  };

  return (
    <div className="login-container">
      <div className="login-form">
        <h2>Sign in to Intellishelf</h2>
        
        {/* OAuth Login Section */}
        <div className="oauth-section">
          <GoogleOAuthButton 
            onSuccess={handleOAuthSuccess} 
            onError={handleOAuthError}
            disabled={isLoading}
          />
          
          <FacebookOAuthButton 
            onSuccess={handleOAuthSuccess} 
            onError={handleOAuthError}
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
