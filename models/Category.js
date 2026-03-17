import mongoose from "mongoose";

const categorySchema = new mongoose.Schema({
  name:{
    type:String,
    required:true,
  },
  status:{
    type:String,
    enum:["active","inactive"],
    default:"active"
  },
  description:{
    type:String,
    trim:true,
    default:""
  },
  isDeleted:{
    type:Boolean,
    default:false
  }
},{timestamps:true})

const Category = mongoose.model("Category",categorySchema)

export default Category