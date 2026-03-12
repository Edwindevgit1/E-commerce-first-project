import express from 'express'
import User from '../../models/User.js'
import bcrypt from 'bcrypt'

const router = express.Router()

const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\W).{8,}$/

router.get('/change-password', async (req, res) => {

  if (!req.session.user) {
    return res.redirect('/api/auth/login')
  }

  try {

    const user = await User.findById(req.session.user.id)

    if (!user) {
      req.session.destroy()
      return res.redirect('/api/auth/login')
    }

    res.render('user/change-password', { user })

  } catch (error) {

    console.log("Change password load error:", error)
    return res.redirect('/api/auth/login')

  }

})


router.post('/change-password', async (req, res) => {

  if (!req.session.user) {
    return res.redirect('/api/auth/login')
  }

  try {

    const { currentPassword, newPassword, confirmPassword } = req.body

    const user = await User.findById(req.session.user.id)

    if (!user) {
      req.session.destroy()
      return res.redirect('/api/auth/login')
    }


    // USER REGISTERED THROUGH GOOGLE (NO PASSWORD YET)
    if (!user.password) {

      if (!newPassword || !confirmPassword) {
        return res.render('user/change-password', {
          user,
          error: "Please enter a new password."
        })
      }

      if (newPassword !== confirmPassword) {
        return res.render('user/change-password', {
          user,
          error: "Passwords do not match."
        })
      }

      if (!passwordRegex.test(newPassword)) {
        return res.render('user/change-password', {
          user,
          error: "Password must contain 8 characters, uppercase, lowercase, and special character."
        })
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10)

      user.password = hashedPassword
      await user.save()

      return res.render('user/change-password', {
        user,
        success: "Password set successfully."
      })

    }


    // NORMAL USER (HAS PASSWORD)

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.render('user/change-password', {
        user,
        error: "All fields are required."
      })
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password)

    if (!isMatch) {
      return res.render('user/change-password', {
        user,
        error: "Current password is incorrect."
      })
    }

    if (newPassword !== confirmPassword) {
      return res.render('user/change-password', {
        user,
        error: "Passwords do not match."
      })
    }

    if (!passwordRegex.test(newPassword)) {
      return res.render('user/change-password', {
        user,
        error: "Password must contain 8 characters, uppercase, lowercase, and special character."
      })
    }

    const isSamePassword = await bcrypt.compare(newPassword, user.password)

    if (isSamePassword) {
      return res.render('user/change-password', {
        user,
        error: "New password cannot be same as old password."
      })
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10)

    user.password = hashedPassword
    await user.save()

    return res.render('user/change-password', {
      user,
      success: "Password updated successfully."
    })

  } catch (error) {

    console.log("Change password error:", error)

    let user = null

    if (req.session?.user?.id) {
      user = await User.findById(req.session.user.id)
    }

    return res.render('user/change-password', {
      user,
      error: "Something went wrong."
    })

  }

})

export default router