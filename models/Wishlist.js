import mongoose  from "mongoose";

const WishlistSchema = new mongoose.Schema(
  {
    user:{
      type:mongoose.Schema.Types.ObjectId,
      ref:"User",
      required:true,
      unique:true
    },
    products:{
      type:[
        {
          type:mongoose.Schema.Types.ObjectId,
          ref:"Product"
        }
      ],
      default:[]
    }
  },
  {timestamps:true}
);
const Wishlist = mongoose.model("Wishlist",WishlistSchema);

export default Wishlist