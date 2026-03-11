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