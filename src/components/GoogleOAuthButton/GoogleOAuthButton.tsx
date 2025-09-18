import React from "react";
import { useGoogleLogin } from '@react-oauth/google';
import "./GoogleOAuthButton.css";

interface GoogleOAuthButtonProps {
  onSuccess: (response: { code: string; redirectUri: string }) => void;
  onError: (error: any) => void;
  disabled?: boolean;
}

const GoogleOAuthButton: React.FC<GoogleOAuthButtonProps> = ({ onSuccess, onError, disabled }) => {
  const login = useGoogleLogin({
    onSuccess: async (codeResponse) => {
      try {
        const oAuthData = {
          code: codeResponse.code,
          redirectUri: window.location.origin
        };
        onSuccess(oAuthData);
      } catch (error) {
        onError(error);
      }
    },
    onError: (error) => onError(error),
    flow: 'auth-code',
    scope: 'email profile'
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
