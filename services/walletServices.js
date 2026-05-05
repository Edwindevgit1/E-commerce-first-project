import User from "../models/User.js";

export const creditWallet = async (userId,amount,reason="",orderId=null) => {
  const value = Math.max(0,Number(amount)||0);
  if(!value)return null;

  return User.findByIdAndUpdate(userId,{
    $inc: { "wallet.balance": value },
    $push: {
      "wallet.transactions": {
        type: "credit",
        amount: value,
        reason,
        order: orderId
      }
    }
  },{new:true})
};
export const debitWallet = async (userId,amount,reason="",orderId=null) => {
  const value = Math.max(0,Number(amount || 0));
  if(!value)return null;
  const user = await User.findOneAndUpdate(
    {
      _id:userId,
      "wallet.balance":{$gte:value}
    },
    {
      $inc:{"wallet.balance":-value},
      $push:{
        "wallet.transactions":{
          type:"debit",
          amount:value,
          reason,
          order:orderId
        }
      }
    },{new:true}
  );
  if(!user){
    throw new Error("Insufficient wallet balance");
  }
  return user;
}