import express from 'express'

const router=express.Router()

router.post('/logout', (req, res) => {

  req.session.destroy((err) => {

    if (err) {
      console.log("Logout error:", err)
      return res.redirect('/api/user/profile')
    }

    res.clearCookie('connect.sid')   
    return res.redirect('/api/auth/login')  

  })

})

export default router