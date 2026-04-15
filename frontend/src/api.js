import axios from "axios";

export const registerUser = (data) => {
  return axios.post("http://127.0.0.1:8000/signup", data);
};