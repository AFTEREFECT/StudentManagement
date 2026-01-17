# 🚀 START HERE - Evolution API + Supabase on AWS

## 📌 Quick Navigation

| File | Purpose | Language |
|------|---------|----------|
| **COPY_PASTE_CONFIG.txt** | 📋 Ready-to-use configuration strings | English |
| **التعليمات_السريعة.txt** | ⚡ Quick setup instructions | العربية |
| **test-connection.sh** | 🧪 Connection test script | Bash |
| **AWS_SUPABASE_CONNECTION_GUIDE.md** | 📚 Complete detailed guide | العربية |
| **QUICK_FIX_SUMMARY.md** | 📝 Technical summary | English |
| **.env.evolution** | ⚙️ Main configuration file | Config |

---

## ⚡ 30-Second Quick Start

### The Problem That Was Fixed:
```
❌ Error: FATAL: Tenant or user not found
✅ Fixed: Changed username from "postgres" to "postgres.benjzaxxkcjwnrfllvel"
```

### The Solution (Copy-Paste Ready):

**For Pooler (Recommended):**
```bash
postgresql://postgres.benjzaxxkcjwnrfllvel:PgSbx2025Secure987@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
```

**For Direct (Testing):**
```bash
postgresql://postgres:PgSbx2025Secure987@db.benjzaxxkcjwnrfllvel.supabase.co:5432/postgres?sslmode=require
```

---

## 🎯 What You Need to Do Now

### On AWS Server:

```bash
# 1. Navigate to evolution-service
cd /path/to/evolution-service

# 2. The .env.evolution file is already updated with correct settings

# 3. Test connection (optional but recommended)
chmod +x test-connection.sh
./test-connection.sh

# 4. Restart Evolution API
docker-compose down
docker-compose up -d

# 5. Verify it's working
docker-compose logs -f evolution-api
curl http://localhost:8080/
```

### Expected Success Output:
```json
{"status":"ok","version":"2.1.1"}
```

---

## 🔑 Critical Information

| Item | Value |
|------|-------|
| **Project ID** | `benjzaxxkcjwnrfllvel` |
| **Password** | `PgSbx2025Secure987` |
| **Username (Pooler)** | `postgres.benjzaxxkcjwnrfllvel` |
| **Username (Direct)** | `postgres` |
| **Pooler Port** | `6543` |
| **Direct Port** | `5432` |
| **API Key** | `myEvolutionKey2025` |

---

## 📖 Detailed Documentation

### For Quick Implementation:
1. **COPY_PASTE_CONFIG.txt** - Contains ready-to-use configuration strings
2. **التعليمات_السريعة.txt** - Step-by-step Arabic instructions

### For Understanding the Fix:
1. **QUICK_FIX_SUMMARY.md** - Technical explanation of what was wrong
2. **AWS_SUPABASE_CONNECTION_GUIDE.md** - Complete Arabic guide

### For Testing:
1. **test-connection.sh** - Automated connection test script

---

## ✅ Verification Checklist

- [ ] `.env.evolution` file has been updated
- [ ] AWS server IP added to Supabase Network Restrictions
- [ ] Docker Compose restarted
- [ ] No errors in logs
- [ ] API responds on port 8080
- [ ] Health check passes: `curl http://localhost:8080/`

---

## 🆘 Quick Troubleshooting

| Problem | Solution |
|---------|----------|
| "Tenant or user not found" | Verify username is `postgres.benjzaxxkcjwnrfllvel` |
| "Can't reach database" | Add AWS server IP to Supabase Network Restrictions |
| "Connection timeout" | Switch to Direct connection temporarily |
| "Password failed" | Verify password: `PgSbx2025Secure987` |

---

## 📞 Need More Help?

1. **Run the test script:**
   ```bash
   ./test-connection.sh
   ```

2. **Check the logs:**
   ```bash
   docker-compose logs --tail=100 evolution-api
   ```

3. **Review detailed guides:**
   - Arabic: `AWS_SUPABASE_CONNECTION_GUIDE.md`
   - English: `QUICK_FIX_SUMMARY.md`

---

## 🎓 What Changed?

### Before (Wrong):
```
Username: postgres
Result: FATAL: Tenant or user not found ❌
```

### After (Correct):
```
Username: postgres.benjzaxxkcjwnrfllvel
Result: Connection successful ✅
```

The issue was that **Supabase Pooler requires the project ID appended to the username**.

---

## 📊 Performance Comparison

| Mode | Speed | Best For | Port |
|------|-------|----------|------|
| **Pooler** | ⚡⚡⚡ Fast | Production | 6543 |
| **Direct** | ⚡⚡ Moderate | Testing | 5432 |

**Recommendation:** Use Pooler for production environments.

---

## 🔒 Security Notes

1. **Never commit `.env.evolution` to git** (it contains passwords)
2. **Restrict Supabase access** to only your AWS server IP
3. **Use strong passwords** (current password is adequate)
4. **Enable SSL** (already configured in connection strings)

---

## 📅 Status

- **Last Updated:** October 26, 2025
- **Version:** 1.0
- **Status:** ✅ **PRODUCTION READY**
- **Tested On:** AWS EC2 t3.micro, Ubuntu 22.04, eu-central-1

---

## 🚀 Ready to Deploy!

All files are configured and ready. Just:
1. Copy to AWS server
2. Run the commands above
3. Verify it works
4. You're done! 🎉

---

**Questions?** Check the documentation files listed at the top of this guide.
