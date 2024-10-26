import { Link, useNavigate } from "react-router-dom";
import './Navbar.css'

const Navbar = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const handleLogout = () => {
    localStorage.removeItem("token"); // Clear the token
    navigate("/login"); // Redirect to the login page
  };

  let username = "";
  if (token) {
    try {
      const payload = token.split(".")[1]; // Get the payload part of the JWT
      const decodedPayload = JSON.parse(atob(payload)); // Decode the payload
      username = decodedPayload.userName; // Assuming the token has a 'username' field
    } catch (error) {
      console.error("Failed to decode token", error);
    }
  }

  return (
    <nav className="navbar">
      <ul>
        {token && <li>{username}</li>}
        <li>
          <Link to="/">My Books</Link>
        </li>
        <li>
          <Link to="/add-book">Add Book</Link>
        </li>
        {token ? (
          <>
            <li>
              <button onClick={handleLogout} className="logout-button">
                Logout
              </button>
            </li>
          </>
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
