import axios from "axios";

export const registerUser = (data) => {
  return axios.post("http://localhost:5000/signup", data);
};