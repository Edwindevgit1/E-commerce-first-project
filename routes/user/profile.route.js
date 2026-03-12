import express from 'express'
import User from '../../models/User.js'
import fs from 'fs'
import path from 'path'

const router = express.Router()

router.get('/profile', async (req, res) => {

  if (!req.session.user) {
    return res.redirect('/api/auth/login')
  }
  if(req.session.user.isBlocked) {
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