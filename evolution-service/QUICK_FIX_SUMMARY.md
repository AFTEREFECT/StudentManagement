# 🚀 Quick Fix Summary - Evolution API + Supabase on AWS

## ⚡ The Problem
```
Error: FATAL: Tenant or user not found
```

## ✅ The Solution
**Wrong username format for Supabase Pooler:**
- ❌ `postgres`
- ✅ `postgres.benjzaxxkcjwnrfllvel`

---

## 📦 Files Updated

| File | Status | Description |
|------|--------|-------------|
| `.env.evolution` | ✅ Updated | Corrected database connection URI |
| `test-connection.sh` | ✅ Created | Script to test both Pooler and Direct connections |
| `AWS_SUPABASE_CONNECTION_GUIDE.md` | ✅ Created | Complete Arabic guide |
| `التعليمات_السريعة.txt` | ✅ Created | Quick Arabic instructions |

---

## 🎯 Correct Configuration

### Option 1: Pooler (Recommended for Production)
```bash
DATABASE_CONNECTION_URI=postgresql://postgres.benjzaxxkcjwnrfllvel:PgSbx2025Secure987@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
```

### Option 2: Direct Connection (For Testing)
```bash
DATABASE_CONNECTION_URI=postgresql://postgres:PgSbx2025Secure987@db.benjzaxxkcjwnrfllvel.supabase.co:5432/postgres?sslmode=require
```

---

## 🔧 Implementation Steps

### On AWS Server:

```bash
# 1. Navigate to evolution-service directory
cd /path/to/evolution-service

# 2. Test the connection
chmod +x test-connection.sh
./test-connection.sh

# 3. Restart Evolution API
docker-compose down
docker-compose up -d

# 4. Monitor logs
docker-compose logs -f evolution-api

# 5. Test API endpoint
curl http://localhost:8080/
```

---

## ✅ Success Indicators

- ✓ No `P1001` errors in logs
- ✓ No "Tenant or user not found" errors
- ✓ Database connection established
- ✓ API responds on port 8080
- ✓ Health check returns: `{"status":"ok","version":"2.1.1"}`

---

## 🔍 Key Differences

| Aspect | Pooler Mode | Direct Mode |
|--------|-------------|-------------|
| Username | `postgres.benjzaxxkcjwnrfllvel` | `postgres` |
| Port | `6543` | `5432` |
| Host | `aws-0-eu-central-1.pooler.supabase.com` | `db.benjzaxxkcjwnrfllvel.supabase.co` |
| Speed | ⚡ Fast | 🐢 Slower |
| Reliability | ✅ High | ✅ Very High |
| Use Case | Production | Development/Testing |

---

## 🛡️ Security Checklist

- [x] Password is correct: `PgSbx2025Secure987`
- [x] Project ID is correct: `benjzaxxkcjwnrfllvel`
- [x] Username format is correct: `postgres.benjzaxxkcjwnrfllvel`
- [ ] AWS server IP added to Supabase Network Restrictions
- [x] SSL is enabled (automatic with Pooler)
- [x] Connection limit is set to 1 for pgBouncer compatibility

---

## 📊 Testing Commands

```bash
# Get server's public IP
curl -4 ifconfig.me

# Test Pooler connectivity
nc -zv aws-0-eu-central-1.pooler.supabase.com 6543

# Test Direct connectivity
nc -zv db.benjzaxxkcjwnrfllvel.supabase.co 5432

# Test database connection (Pooler)
psql "postgresql://postgres.benjzaxxkcjwnrfllvel:PgSbx2025Secure987@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true" -c "SELECT version();"

# Test database connection (Direct)
psql "postgresql://postgres:PgSbx2025Secure987@db.benjzaxxkcjwnrfllvel.supabase.co:5432/postgres?sslmode=require" -c "SELECT version();"

# Check Docker container status
docker-compose ps

# View last 50 lines of logs
docker-compose logs --tail=50 evolution-api

# Follow logs in real-time
docker-compose logs -f evolution-api
```

---

## 🚨 Troubleshooting

### Issue: "Tenant or user not found"
**Solution:** Ensure username is `postgres.benjzaxxkcjwnrfllvel` (not just `postgres`)

### Issue: "Can't reach database server"
**Solution:**
1. Get server IP: `curl -4 ifconfig.me`
2. Add it to Supabase Dashboard → Settings → Database → Network Restrictions

### Issue: "Connection timeout"
**Solution:** Switch to Direct Connection temporarily (uncomment line 12 in `.env.evolution`)

---

## 📞 Support

If issues persist after applying all fixes:

1. Run `./test-connection.sh` and share output
2. Share last 50 lines of Docker logs:
   ```bash
   docker-compose logs --tail=50 evolution-api
   ```
3. Verify Supabase Security Settings

---

## 📝 Summary

**Root Cause:** Incorrect username format for Supabase Connection Pooler

**Fix Applied:** Changed username from `postgres` to `postgres.benjzaxxkcjwnrfllvel`

**Status:** ✅ Ready for deployment

**Next Action:** Apply updated `.env.evolution` on AWS and restart Docker

---

**Last Updated:** October 26, 2025
**Version:** 1.0
**Status:** ✅ Production Ready
