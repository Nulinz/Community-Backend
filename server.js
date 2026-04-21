import cors from "cors";
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import path from "path";

import connectDB from "./config/db.js";
import errorMiddleware from "./middleware/error.middleware.js";
import userRoutes from "./routes/userRoutes.js";
import userDetailsRoutes from "./routes/userDetails.js"
import companyRoutes from "./routes/companyRoutes.js";
import collegeRoutes from "./routes/collegeRoutes.js"
import eventRoutes from "./routes/eventRoutes.js"
import competitionRoutes from "./routes/competitionRoutes.js"
import conferenceRoutes from "./routes/conferenceRoutes.js"
import seminarRoutes from "./routes/seminarRoutes.js"
import internshipRoutes from "./routes/internshipRoutes.js"
import freelanceRoutes from "./routes/freelanceRoutes.js"


const app = express();
const PORT = process.env.PORT || 5000;

const allowedOrigins = [
  process.env.FRONTEND_URL,
  "http://localhost:5173",
  "http://127.0.0.1:5173",
].filter(Boolean);


app.use(
  cors({
    origin: allowedOrigins,
    credentials: true
  })
);



app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));


app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Nulinz backend is running",
  });
});


app.use("/api/users", userRoutes);
app.use("/api/userDetails", userDetailsRoutes);
app.use("/api/company", companyRoutes);
app.use("/api/college",collegeRoutes)
app.use("/api/event", eventRoutes)
app.use("/api/competition", competitionRoutes)
app.use("/api/conference", conferenceRoutes)
app.use("/api/seminar", seminarRoutes)
app.use("/api/internship", internshipRoutes)
app.use("/api/freelance", freelanceRoutes)





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
