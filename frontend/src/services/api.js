import axios from "axios";

const API = axios.create({
  baseURL: "http://127.0.0.1:8000", // FastAPI backend
});

export const loginUser = (data) => API.post("/login", data);
export const signupUser = (data) => API.post("/signup", data);
export const registerUser = signupUser;
export const forgotPasswordUser = (data) => API.post("/forgot-password", data);
