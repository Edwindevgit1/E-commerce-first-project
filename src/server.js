import dotenv from "dotenv";
dotenv.config();

import connectDB from "../config/db.js";

const startServer = async () => {
  const { default: app } = await import("./app.js");

  const PORT = 5000;

  await connectDB();

  app.listen(PORT, () => {
    console.log("server started on port 5000");
  });
};

startServer();