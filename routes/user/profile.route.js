import express from 'express'
import User from '../../models/User.js'
import upload from '../../middleware/user/uploadimage.js'
import fs from 'fs'
import path from 'path'

const router = express.Router()

/* ===============================
   PROFILE PAGE
================================ */
router.get('/profile', async (req, res) => {

  if (!req.session.user) {
    return res.redirect('/api/auth/login')
  }

  try {
    const user = await User.findById(req.session.user.id)

    if (!user) {
      req.session.destroy()
      return res.redirect('/api/auth/login')
    }

    res.render('user/profile', { user })

  } catch (error) {
    console.log("Profile load error:", error)
    res.redirect('/api/auth/login')
  }
})



/* ===============================
   UPDATE PROFILE
================================ */
router.post(
  '/update-profile',
  upload.single('profileImage'),
  async (req, res) => {

    if (!req.session.user) {
      return res.redirect('/api/auth/login')
    }

    try {
      const user = await User.findById(req.session.user.id)

      if (!user) {
        return res.redirect('/api/auth/login')
      }

      const newName = req.body.name?.trim()
      const newEmail = req.body.email?.trim().toLowerCase()

      /* ---------- EMAIL DUPLICATE CHECK ---------- */
      if (newEmail && newEmail !== user.email) {

        const existingUser = await User.findOne({ email: newEmail })

        if (existingUser) {
          return res.render('user/profile', {
            user,
            error: "Email already in use"
          })
        }

        user.email = newEmail
      }

      /* ---------- UPDATE NAME ---------- */
      if (newName) {
        user.name = newName
      }

      /* ---------- UPDATE IMAGE ---------- */
      if (req.file) {

        // delete old image if exists
        if (user.profileImage) {

          const oldImagePath = path.join(
            process.cwd(),
            'public',
            user.profileImage
          )

          if (fs.existsSync(oldImagePath)) {
            fs.unlinkSync(oldImagePath)
          }
        }

        user.profileImage = "/uploads/" + req.file.filename
      }

      await user.save()

      /* ---------- UPDATE SESSION ---------- */
      req.session.user.name = user.name
      req.session.user.email = user.email

      res.redirect('/api/user/profile')

    } catch (error) {
      console.log("Update profile error:", error)
      res.redirect('/api/user/profile')
    }
  }
)



/* ===============================
   DELETE AVATAR
================================ */
router.post('/delete-avatar', async (req, res) => {

  if (!req.session.user) {
    return res.redirect('/api/auth/login')
  }

  try {
    const user = await User.findById(req.session.user.id)

    if (!user) {
      return res.redirect('/api/auth/login')
    }

    if (user.profileImage) {

      const imagePath = path.join(
        process.cwd(),
        'public',
        user.profileImage
      )

      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath)
      }

      user.profileImage = null
      await user.save()
    }

    res.redirect('/api/user/profile')

  } catch (error) {
    console.log("Delete avatar error:", error)
    res.redirect('/api/user/profile')
  }
})


export default router