import axios from "axios";

const API = axios.create({
  baseURL: "http://127.0.0.1:8000", // your FastAPI backend
});

export const loginUser = (data) => API.post("/login", data);
