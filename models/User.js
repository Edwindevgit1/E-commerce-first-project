import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },

    password: {
      type: String
    },

    googleId: {
      type: String
    },

    provider: {
      type: String,
      enum: ["local", "google"],
      required: true
    },

    role: {
      type: String,
      enum: ["user", "admin", "superadmin"],
      default: "user"
    },

    isBlocked: {
      type: Boolean,
      default: false
    },

    isVerified: {
      type: Boolean,
      default: false
    },

    resetOtp: {
      type: String
    },

    resetOtpExpiry: {
      type: Date
    },

    profileImage: {
      type: String,
      default: "/images/avatar.png"
    },
    referralCode: {
      type: String,
      unique: true,
      sparse: true,
      uppercase: true,
      trim: true
    },
    referredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    referredByCode: {
      type: String,
      default: "",
      uppercase: true,
      trim: true
    },
    referralOffer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ReferralOffer",
      default: null
    },
    referralOfferTitle: {
      type: String,
      default: "",
      trim: true
    },
    referralOfferMessage: {
      type: String,
      default: "",
      trim: true
    },
    referralRewardAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    referralMinPurchase: {
      type: Number,
      default: 100,
      min: 0
    },
    referralRewardedAt: {
      type: Date,
      default: null
    },
    referralRewardedOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null
    },
    referrerRewardedAt: {
      type: Date,
      default: null
    },
    wallet: {
      balance: {
        type: Number,
        default: 0,
        min: 0
      },
      transactions: [
        {
          type: {
            type: String,
            enum: ["credit", "debit"],
            required: true
          },
          amount: {
            type: Number,
            required: true,
            min: 0
          },
          reason: {
            type: String,
            default: ""
          },
          order: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Order",
            default: null
          },
          createdAt: {
            type: Date,
            default: Date.now
          }
        }
      ]
    },
    addresses: [
      {
        type: {
          type: String,
          required: true,
          trim: true
        },

        street: {
          type: String,
          required: true,
          trim: true
        },

        city: {
          type: String,
          required: true,
          trim: true
        },

        state: {
          type: String,
          required: true,
          trim: true
        },

        pincode: {
          type: String,
          required: true,
          trim: true
        },

        isDefault: {
          type: Boolean,
          default: false
        }
      }
    ]

  },
  {
    timestamps: true
  }
);

const User = mongoose.model("User", userSchema);

export default User;
