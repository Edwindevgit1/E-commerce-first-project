import express from 'express'
import User from '../../models/User.js'

const router = express.Router()


router.get('/adress', async (req, res) => {

  if (!req.session.user) {
    return res.redirect('/api/auth/login')
  }

  try {
    const user = await User.findById(req.session.user.id)

    if (!user) {
      req.session.destroy()
      return res.redirect('/api/auth/login')
    }

    res.render('user/adress-management', {
      user,
      addresses: user.addresses || []
    })

  } catch (error) {
    console.log('Address route error:', error)
    res.redirect('/api/auth/login')
  }
})


router.post('/add-address', async (req, res) => {

  if (!req.session.user) {
    return res.redirect('/api/auth/login')
  }

  try {
    const { type, street, city, state, pincode } = req.body
    const user = await User.findById(req.session.user.id)

    if (!user) return res.redirect('/api/auth/login')

    const isFirstAddress = user.addresses.length === 0

    user.addresses.push({
      type,
      street,
      city,
      state,
      pincode,
      isDefault: isFirstAddress
    })

    await user.save()

    res.redirect('/api/user/adress')

  } catch (error) {
    console.log('Add address error:', error)
    res.redirect('/api/user/adress')
  }
})


router.post('/delete-address/:id', async (req, res) => {

  if (!req.session.user) {
    return res.redirect('/api/auth/login')
  }

  try {
    const user = await User.findById(req.session.user.id)
    if (!user) return res.redirect('/api/auth/login')

    user.addresses = user.addresses.filter(
      addr => addr._id.toString() !== req.params.id
    )

    await user.save()

    res.redirect('/api/user/adress')

  } catch (error) {
    console.log('Delete address error:', error)
    res.redirect('/api/user/adress')
  }
})


/* ============================
   SET DEFAULT ADDRESS
============================ */
router.post('/set-default/:id', async (req, res) => {

  if (!req.session.user) {
    return res.redirect('/api/auth/login')
  }

  try {
    const user = await User.findById(req.session.user.id)
    if (!user) return res.redirect('/api/auth/login')

    user.addresses.forEach(addr => {
      addr.isDefault = addr._id.toString() === req.params.id
    })

    await user.save()

    res.redirect('/api/user/adress')

  } catch (error) {
    console.log('Set default error:', error)
    res.redirect('/api/user/adress')
  }
})


/* ============================
   LOAD EDIT PAGE
============================ */
router.get('/edit-address/:id', async (req, res) => {

  if (!req.session.user) {
    return res.redirect('/api/auth/login')
  }

  const user = await User.findById(req.session.user.id)
  if (!user) return res.redirect('/api/auth/login')

  const address = user.addresses.id(req.params.id)
  if (!address) return res.redirect('/api/user/adress')

  res.render('user/edit-address', {
    user,
    address
  })
})


/* ============================
   UPDATE ADDRESS
============================ */
router.post('/update-address/:id', async (req, res) => {

  if (!req.session.user) {
    return res.redirect('/api/auth/login')
  }

  const user = await User.findById(req.session.user.id)
  if (!user) return res.redirect('/api/auth/login')

  const address = user.addresses.id(req.params.id)
  if (!address) return res.redirect('/api/user/adress')

  const { type, street, city, state, pincode } = req.body

  address.type = type
  address.street = street
  address.city = city
  address.state = state
  address.pincode = pincode

  await user.save()

  res.redirect('/api/user/adress')
})

export default router