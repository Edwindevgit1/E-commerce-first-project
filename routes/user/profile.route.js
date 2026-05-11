import express from 'express'
import User from '../../models/User.js'
import fs from 'fs'
import path from 'path'
import {
  buildReferralMeta,
  ensureUserReferralCode,
  getReferralSettings
} from '../../services/referralServices.js'

const router = express.Router()

const sumTransactions = (transactions, predicate) =>
  transactions.reduce((total, transaction) => {
    if (!predicate(transaction)) return total
    return total + (Number(transaction.amount) || 0)
  }, 0)

const buildReferralLink = (req, referralCode = "") =>
  `${req.protocol}://${req.get("host")}/api/auth/register?ref=${encodeURIComponent(referralCode || "")}`

router.get('/profile', async (req, res) => {

  if (!req.session.user) {
    return res.redirect('/api/auth/login')
  }
  if(req.session.user.isBlocked) {
    return res.redirect('/api/auth/login')
  }
  try {
    const user = await User.findById(req.session.user.id)
    const referralSettings = await getReferralSettings()

    if (!user) {
      req.session.destroy()
      return res.redirect('/api/auth/login')
    }

    if (referralSettings.referralDisplayEnabled !== false) {
      await ensureUserReferralCode(user)
    }
    res.render('user/profile', {
      user,
      referralSettings,
      referralLink:
        referralSettings.referralDisplayEnabled === false
          ? ""
          : buildReferralLink(req, user.referralCode)
    })

  } catch (error) {
    console.log("Profile load error:", error)
    res.redirect('/api/auth/login')
  }
})

router.get('/wallet', async (req, res) => {

  if (!req.session.user) {
    return res.redirect('/api/auth/login')
  }
  if(req.session.user.isBlocked) {
    return res.redirect('/api/auth/login')
  }

  try {
    const [user, referralSettings] = await Promise.all([
      User.findById(req.session.user.id)
      .populate('wallet.transactions.order', 'orderId')
      .populate('referredBy', 'name referralCode'),
      getReferralSettings()
    ])

    if (!user) {
      req.session.destroy()
      return res.redirect('/api/auth/login')
    }

    if (referralSettings.referralDisplayEnabled !== false) {
      await ensureUserReferralCode(user)
    }

    const wallet = user.wallet || { balance: 0, transactions: [] }
    const transactions = [...(wallet.transactions || [])]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

    const isRefund = (transaction) =>
      transaction.type === 'credit' && String(transaction.reason || '').toLowerCase().includes('refund')

    const creditTransactions = transactions.filter((transaction) => transaction.type === 'credit')

    const pageSize = 5
    const totalPages = Math.max(1, Math.ceil(transactions.length / pageSize))
    const currentPage = Math.min(
      Math.max(parseInt(req.query.page, 10) || 1, 1),
      totalPages
    )
    const startIndex = (currentPage - 1) * pageSize

    const stats = {
      cashbackEarned: sumTransactions(transactions, (transaction) =>
        transaction.type === 'credit' && !isRefund(transaction)
      ),
      refundsReceived: sumTransactions(transactions, isRefund),
      pendingCredits: 0,
      lastAdded: Number(creditTransactions[0]?.amount || 0)
    }

    res.render('user/wallet', {
      user,
      wallet,
      stats,
      referralMeta: buildReferralMeta(
        user,
        referralSettings,
        referralSettings.referralDisplayEnabled === false
          ? ""
          : buildReferralLink(req, user.referralCode)
      ),
      referralSettings,
      transactions: transactions.slice(startIndex, startIndex + pageSize),
      pagination: {
        currentPage,
        totalPages,
        hasPrev: currentPage > 1,
        hasNext: currentPage < totalPages
      }
    })

  } catch (error) {
    console.log("Wallet load error:", error)
    res.redirect('/api/user/profile')
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
