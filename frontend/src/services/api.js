import axios from "axios";

const API = axios.create({
<<<<<<< HEAD
  baseURL: "http://127.0.0.1:8000", // FastAPI backend
});

export const loginUser = (data) => API.post("/login", data);
export const signupUser = (data) => API.post("/signup", data);
export const forgotPasswordUser = (data) => API.post("/forgot-password", data);
=======
  baseURL: "http://127.0.0.1:8000/api",
});

export const loginUser = (data) => {
  return axios.post("http://127.0.0.1:8000/login", data);
};

export const registerUser = (data) => {
  return axios.post("http://127.0.0.1:8000/signup", data);
};
>>>>>>> origin/main
