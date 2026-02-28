import express from "express";

const router=express.Router()

router.get('/home', (req, res) => {
  res.render('user/home', {
    user: req.session.user
  });
});

export default router 