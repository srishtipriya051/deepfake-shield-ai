import axios from "axios";

const API = axios.create({
  baseURL: "http://127.0.0.1:8000/api",
});

export const loginUser = (data) => {
  return axios.post("http://127.0.0.1:8000/login", data);
};

export const registerUser = (data) => {
  return axios.post("http://127.0.0.1:8000/signup", data);
};