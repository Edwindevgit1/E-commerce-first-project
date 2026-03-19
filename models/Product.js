import mongoose from "mongoose";

const productSchema = new mongoose.Schema({
  productName:{
    type:String,
    required:true,
    trim:true
  },
  description:{
    type:String,
    default:""
  },
  category:{
    type:mongoose.Schema.Types.ObjectId,
    ref:"Category",
    required:true
  },
  price:{
    type:Number,
    required:true
  },
  stock:{
    type:Number,
    required:true
  },
  sizes:[
    {
      type:String
    }
  ],
  colors:[
    {
      type:String
    }
  ],
  images:{
    type:[String],
    validate:[
      arr=> arr.length>=3,
      "Minimum 3 images required"
    ]
  },
  mainImageIndex:{
    type:Number,
    default:0
  },
  status:{
    type:String,
    enum:["active","inactive"],
    default:"active"
  },
  isDeleted:{
    type:Boolean,
    default:false
  },
},{timestamps:true})

const Product = mongoose.model("Product",productSchema)

export default Product
