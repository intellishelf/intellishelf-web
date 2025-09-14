import React from "react";
import { useGoogleLogin } from '@react-oauth/google';
import "./GoogleOAuthButton.css";

interface GoogleOAuthButtonProps {
  onSuccess: (tokenResponse: any) => void;
  onError: (error: any) => void;
  disabled?: boolean;
}

const GoogleOAuthButton: React.FC<GoogleOAuthButtonProps> = ({ onSuccess, onError, disabled }) => {
  const login = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        const oAuthData = {
          provider: "Google",
          accessToken: tokenResponse.access_token,
        };
        onSuccess(oAuthData);
      } catch (error) {
        onError(error);
      }
    },
    onError: (error) => onError(error),
    flow: 'implicit', // Use implicit flow to get access token directly
    scope: 'email profile', // Request these scopes
  });

  return (
    <div className="google-oauth-container" style={{ opacity: disabled ? 0.5 : 1 }}>
      <button 
        onClick={() => login()} 
        disabled={disabled}
        className="google-oauth-button"
      >
        <img 
          src="https://developers.google.com/identity/images/g-logo.png" 
          alt="Google logo" 
          className="google-logo"
        />
        <span>Sign in with Google</span>
      </button>
    </div>
  );
};

export default GoogleOAuthButton;
