import React from "react";
import "./GoogleOAuthButton.css";

interface GoogleOAuthButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

const GoogleOAuthButton: React.FC<GoogleOAuthButtonProps> = ({ onClick, disabled }) => {
  const handleClick = () => {
    if (!disabled) {
      onClick();
    }
  };

  return (
    <div className="google-oauth-container" style={{ opacity: disabled ? 0.5 : 1 }}>
      <button
        onClick={handleClick}
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
