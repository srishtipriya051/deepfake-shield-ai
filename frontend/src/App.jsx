import { Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
<<<<<<< HEAD
=======
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
>>>>>>> origin/main

function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/dashboard" element={<Dashboard />} />
    </Routes>
  );
}

export default App;