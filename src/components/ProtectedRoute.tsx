import { Outlet } from "react-router-dom";
import Navbar from "./Navbar/Navbar";

const ProtectedRoute = () => {
  return (
    <>
      <Navbar />
      <div className="main-content">
        <Outlet />
      </div>
    </>
  );
};

export default ProtectedRoute;
