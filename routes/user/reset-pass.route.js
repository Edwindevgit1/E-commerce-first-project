import express from "express"
import resetpassword from "../../controllers/resetpasswordController.js"

const router = express.Router()

router.get('/resetpassword', (req,res)=>{

  if (!req.session.resetEmail || !req.session.otpVerified) {
    return res.redirect('/api/auth/forgotpassword')
  }

  res.set("Cache-Control","no-store, no-cache, must-revalidate, private")

  res.render('user/reset-password')

})

router.post('/resetpassword', resetpassword)

export default router
