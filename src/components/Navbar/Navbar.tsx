import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import useAuth from "../../hooks/useAuth";
import { apiClient, ApiError } from "../../utils/apiClient";
import "./Navbar.css";

interface CurrentUserResponse {
  userName?: string;
  name?: string;
  email?: string;
}

const Navbar = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [currentUser, setCurrentUser] = useState<string | null>(null);

  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const user = await apiClient.get<CurrentUserResponse>("/auth/me");
        const displayName = user.userName || user.name || user.email || null;
        setCurrentUser(displayName);
      } catch (error) {
        if (error instanceof ApiError && error.statusCode === 401) {
          setCurrentUser(null);
        } else {
          console.error("Failed to load user", error);
          setCurrentUser(null);
        }
      }
    };

    fetchCurrentUser();
  }, []);

  const handleLogout = async () => {
    await logout();
    setCurrentUser(null);
    navigate("/login");
  };

  const isAuthenticated = !!currentUser;

  return (
    <nav className="navbar">
      <ul>
        {isAuthenticated && <li>{currentUser}</li>}
        <li>
          <Link to="/">My Books</Link>
        </li>
        <li>
          <Link to="/add-book">Add Book</Link>
        </li>
        {isAuthenticated ? (
          <li>
            <button onClick={handleLogout} className="logout-button">
              Logout
            </button>
          </li>
        ) : (
          <li>
            <Link to="/login">Login</Link>
          </li>
        )}
      </ul>
    </nav>
  );
};

export default Navbar;
