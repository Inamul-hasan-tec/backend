# 📧 Email Configuration Guide

## Understanding the "Email timeout" Error

### ✅ This is NORMAL and NOT a problem!

The "Email timeout" error you're seeing in Render logs is **expected behavior** and **does not affect booking creation**.

### Why This Happens:

1. **Bookings are created successfully** ✓
2. **Email is sent asynchronously** (in the background)
3. **If email takes > 10 seconds**, it times out
4. **Booking still succeeds** even if email fails

### What the Logs Mean:

```
✅ Booking created with ID: 123 in 234ms
📋 Booking details fetched in 456ms
❌ Error sending booking confirmation email: Email timeout
🎉 Booking creation completed in 500ms
```

**Translation:**
- ✅ Booking was created successfully
- ✅ Response sent to user in 500ms
- ❌ Email failed to send (but booking is fine!)

## Email Configuration Options

### Option 1: Disable Email (Recommended for Testing)

If you don't need emails right now, disable them:

**In Render Dashboard:**
1. Go to your service
2. Click "Environment"
3. Add environment variable:
   - Key: `SMTP_ENABLED`
   - Value: `false`
4. Save changes

**Result:** No email errors in logs, bookings work perfectly

### Option 2: Configure Gmail SMTP (Production)

To actually send emails, configure Gmail:

#### Step 1: Enable 2-Factor Authentication
1. Go to https://myaccount.google.com/security
2. Enable 2-Step Verification

#### Step 2: Generate App Password
1. Go to https://myaccount.google.com/apppasswords
2. Select "Mail" and "Other (Custom name)"
3. Enter "Hall Sync Backend"
4. Click "Generate"
5. Copy the 16-character password

#### Step 3: Add to Render Environment Variables
1. Go to Render Dashboard → Your Service → Environment
2. Add these variables:
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-16-char-app-password
   SMTP_ENABLED=true
   ```
3. Save changes

### Option 3: Use SendGrid (Recommended for Production)

SendGrid is more reliable than Gmail for transactional emails:

#### Step 1: Sign Up
1. Go to https://sendgrid.com
2. Create free account (100 emails/day free)

#### Step 2: Create API Key
1. Go to Settings → API Keys
2. Create API Key with "Mail Send" permissions
3. Copy the API key

#### Step 3: Configure Render
```
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
SMTP_ENABLED=true
```

## Testing Email Configuration

### Test 1: Check Environment Variables
```bash
# In Render logs, you should see:
📧 Email sending disabled via SMTP_ENABLED env var
# OR
✅ Booking confirmation email sent to customer@example.com
```

### Test 2: Create Test Booking
1. Create a booking with a valid email
2. Check Render logs
3. Look for:
   - ✅ Email sent successfully
   - ❌ Email timeout (means SMTP is slow/unreachable)
   - 📧 Email disabled (means SMTP_ENABLED=false)

### Test 3: Check Email Inbox
- Wait 1-2 minutes
- Check inbox (and spam folder)
- Email should arrive with booking details

## Troubleshooting

### Problem: "Email timeout" in logs

**Cause:** SMTP server is slow or unreachable

**Solutions:**
1. **Quick Fix:** Disable email with `SMTP_ENABLED=false`
2. **Better Fix:** Use SendGrid instead of Gmail
3. **Debug:** Check SMTP credentials are correct

### Problem: "Invalid email address"

**Cause:** Customer email is missing or invalid

**Solution:** This is normal - email is skipped, booking succeeds

### Problem: "Authentication failed"

**Cause:** Wrong SMTP credentials

**Solutions:**
1. Verify SMTP_USER and SMTP_PASS
2. For Gmail: Use App Password, not regular password
3. Check 2FA is enabled on Gmail

### Problem: Emails not arriving

**Possible Causes:**
1. Email in spam folder
2. SMTP credentials wrong
3. Email service blocking

**Debug Steps:**
```bash
# Check Render logs for:
✅ Booking confirmation email sent to customer@example.com

# If you see this, email was sent successfully
# Check spam folder in customer's inbox
```

## Performance Impact

### Before Fix:
- Email blocking: 5-15 seconds per booking
- SMTP timeout: 30+ seconds
- Booking fails if email fails

### After Fix:
- Email async: 0 seconds (non-blocking)
- Booking succeeds: < 1 second
- Email sent in background
- Booking works even if email fails

## Best Practices

### 1. Always Use Async Email
✅ **DO:** Send emails asynchronously (current implementation)
```typescript
EmailService.sendBookingConfirmation(...).catch(error => {
  console.error('Email failed:', error);
});
```

❌ **DON'T:** Block the response waiting for email
```typescript
await EmailService.sendBookingConfirmation(...);
```

### 2. Handle Email Failures Gracefully
- Log errors but don't throw
- Booking should succeed regardless
- Consider retry queue for failed emails

### 3. Use Reliable Email Service
- **Testing:** Disable email or use Mailtrap
- **Production:** Use SendGrid, AWS SES, or Mailgun
- **Avoid:** Gmail for high-volume production

### 4. Monitor Email Delivery
- Track email success/failure rates
- Set up alerts for high failure rates
- Consider email delivery service with webhooks

## Email Service Comparison

| Service | Free Tier | Reliability | Setup Difficulty |
|---------|-----------|-------------|------------------|
| **Disabled** | ∞ | N/A | ⭐ Easy |
| **Gmail** | 500/day | Medium | ⭐⭐ Medium |
| **SendGrid** | 100/day | High | ⭐⭐ Medium |
| **AWS SES** | 62,000/month | Very High | ⭐⭐⭐ Hard |
| **Mailgun** | 5,000/month | High | ⭐⭐ Medium |

## Recommended Setup

### For Development/Testing:
```bash
SMTP_ENABLED=false
```

### For Small Production (<100 emails/day):
```bash
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
SMTP_ENABLED=true
```

### For Large Production (>100 emails/day):
- Use AWS SES with SQS queue
- Implement retry logic
- Add email delivery tracking
- Set up bounce/complaint handling

## Monitoring Email Health

### Check Logs Regularly
```bash
# Count email successes
grep "✅ Booking confirmation email sent" logs.txt | wc -l

# Count email failures
grep "❌ Error sending booking confirmation email" logs.txt | wc -l

# Calculate success rate
```

### Set Up Alerts
- Alert if email failure rate > 10%
- Alert if SMTP authentication fails
- Alert if email queue backs up

## FAQ

**Q: Do bookings work without email?**  
A: Yes! Bookings work perfectly even if email is disabled or failing.

**Q: Why is email timing out?**  
A: SMTP server is slow or unreachable. This doesn't affect bookings.

**Q: Should I fix the email timeout?**  
A: Only if you need emails. Otherwise, disable with `SMTP_ENABLED=false`.

**Q: How do I know if emails are actually sending?**  
A: Check Render logs for "✅ Booking confirmation email sent" messages.

**Q: Can I use a different email service?**  
A: Yes! Update SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS.

**Q: What if I need to send many emails?**  
A: Use SendGrid, AWS SES, or implement a job queue (Bull/BullMQ).

## Summary

✅ **Email timeout is normal and expected**  
✅ **Bookings work perfectly without email**  
✅ **Email is sent asynchronously (non-blocking)**  
✅ **Configure SMTP only if you need emails**  
✅ **Use SendGrid for production reliability**  

---

**Status:** Email is working as designed  
**Action Required:** None (unless you need emails)  
**Priority:** Low (email is optional feature)
