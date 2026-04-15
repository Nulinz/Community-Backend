import cors from "cors";
import dotenv from "dotenv";
dotenv.config();

import express from "express";

import connectDB from "./config/db.js";
import errorMiddleware from "./middleware/error.middleware.js";
import userRoutes from "./routes/userRoutes.js";
import userDetailsRoutes from "./routes/userDetails.js"


const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Nulinz backend is running",
  });
});

app.use("/api/users", userRoutes);
app.use("/api/userDetails", userDetailsRoutes);




// error
app.use((req, res, next) => {
  const error = new Error(`Route not found: ${req.originalUrl}`);
  error.status = 404;
  next(error);
});

app.use(errorMiddleware);




const startServer = async () => {
  if (process.env.MONGO_URI) {
    await connectDB();
  } else {
    console.warn("MONGO_URI not found. Starting server without database connection.");
  }

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};



startServer();
