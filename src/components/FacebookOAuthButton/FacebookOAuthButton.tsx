import React, { useEffect } from "react";
import "./FacebookOAuthButton.css";

interface FacebookOAuthButtonProps {
  onSuccess: (tokenResponse: any) => void;
  onError: (error: any) => void;
  disabled?: boolean;
}

declare global {
  interface Window {
    FB: any;
    fbAsyncInit: () => void;
  }
}

const FacebookOAuthButton: React.FC<FacebookOAuthButtonProps> = ({ onSuccess, onError, disabled }) => {
  useEffect(() => {
    // Initialize Facebook SDK when it's loaded
    const initializeFB = () => {
      if (window.FB) {
        window.FB.init({
          appId: process.env.REACT_APP_FACEBOOK_APP_ID,
          cookie: true,
          xfbml: true,
          version: 'v18.0'
        });
      }
    };

    // Initialize Facebook SDK
    window.fbAsyncInit = initializeFB;

    // If FB is already loaded, initialize immediately
    if (window.FB) {
      initializeFB();
    }
  }, []);

  const handleFacebookLogin = () => {
    if (disabled) return;

    window.FB.login((response: any) => {
      if (response.authResponse) {
        // Get user profile information
        window.FB.api('/me', { fields: 'name,email' }, (userInfo: any) => {
          const oAuthData = {
            provider: "Facebook",
            accessToken: response.authResponse.accessToken,
            email: userInfo.email,
            name: userInfo.name,
          };

          onSuccess(oAuthData);
        });
      } else {
        onError(new Error('Facebook login was cancelled'));
      }
    }, { scope: 'email' });
  };

  return (
    <div className="facebook-oauth-container">
      <button 
        className="facebook-login-button" 
        onClick={handleFacebookLogin}
        disabled={disabled}
      >
        <svg className="facebook-icon" viewBox="0 0 24 24" width="20" height="20">
          <path fill="white" d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
        </svg>
        Continue with Facebook
      </button>
    </div>
  );
};

export default FacebookOAuthButton;