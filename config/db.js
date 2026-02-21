import mongoose from "mongoose";
const connectDB = async()=>{
  try {
    await mongoose.connect("mongodb://127.0.0.1:27017/ecommerceproject");
    console.log("MongoDB connected");
  } catch (error) {
    console.error(error);
    console.log("mongodb connection error")
    process.exit(1)
  }
}
export default connectDB;