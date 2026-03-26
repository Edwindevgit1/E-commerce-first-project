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
  offerPercentage: {
    type: Number,
    default: 0,
    min: 0,
    max: 90
  },
  isDeleted:{
    type:Boolean,
    default:false
  }
},{timestamps:true})

const Category = mongoose.model("Category",categorySchema)

export default Category
