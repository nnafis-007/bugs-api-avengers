# Kibana Data Views Setup Guide

## 📊 Log Indices Created

After restarting filebeat, logs will be routed to these indices:

| Log Type | Index Pattern | Matched Keyword |
|----------|---------------|-----------------|
| Donations | `donation-logs-*` | "donation" |
| Balance | `balance-logs-*` | "balance" |
| Payments | `payment-logs-*` | "payment" |
| Processing | `processing-logs-*` | "processing" |
| Registrations | `registration-logs-*` | "register" |
| Campaigns | `campaign-logs-*` | "campaign" |
| All Other Logs | `filebeat-*` | (default) |

## 🔄 Apply Changes

```bash
# Restart filebeat to apply new configuration
docker-compose restart filebeat

# Wait 10-20 seconds for logs to start flowing
# Run some operations to generate logs
node stress-test.js donate 10 2
node stress-test.js register 10 2
node stress-test.js campaigns 10 2
```

## 📋 How to Add Data Views in Kibana

### Step 1: Access Kibana
Open http://localhost/kibana/

### Step 2: Navigate to Data Views
1. Click the ☰ menu (top-left)
2. Scroll to **Management** section
3. Click **Stack Management**
4. Under **Kibana** section, click **Data Views**

### Step 3: Create Each Data View

#### For Donation Logs:
1. Click **Create data view** button
2. Fill in:
   - **Name:** `Donation Logs`
   - **Index pattern:** `donation-logs-*`
   - **Timestamp field:** `@timestamp`
3. Click **Save data view to Kibana**

#### For Balance Logs:
1. Click **Create data view** button
2. Fill in:
   - **Name:** `Balance Logs`
   - **Index pattern:** `balance-logs-*`
   - **Timestamp field:** `@timestamp`
3. Click **Save data view to Kibana**

#### For Payment Logs:
1. Click **Create data view** button
2. Fill in:
   - **Name:** `Payment Logs`
   - **Index pattern:** `payment-logs-*`
   - **Timestamp field:** `@timestamp`
3. Click **Save data view to Kibana**

#### For Processing Logs:
1. Click **Create data view** button
2. Fill in:
   - **Name:** `Processing Logs`
   - **Index pattern:** `processing-logs-*`
   - **Timestamp field:** `@timestamp`
3. Click **Save data view to Kibana**

#### For Registration Logs:
1. Click **Create data view** button
2. Fill in:
   - **Name:** `Registration Logs`
   - **Index pattern:** `registration-logs-*`
   - **Timestamp field:** `@timestamp`
3. Click **Save data view to Kibana**

#### For Campaign Logs:
1. Click **Create data view** button
2. Fill in:
   - **Name:** `Campaign Logs`
   - **Index pattern:** `campaign-logs-*`
   - **Timestamp field:** `@timestamp`
3. Click **Save data view to Kibana**

#### For All Logs (General):
1. Click **Create data view** button
2. Fill in:
   - **Name:** `All Application Logs`
   - **Index pattern:** `filebeat-*`
   - **Timestamp field:** `@timestamp`
3. Click **Save data view to Kibana**

### Step 4: View Logs in Discover

1. Click ☰ menu → **Analytics** → **Discover**
2. In the top-left dropdown, select the data view you want to see:
   - **Donation Logs** - Shows only donation-related logs
   - **Payment Logs** - Shows only payment-related logs
   - **Balance Logs** - Shows only balance-related logs
   - etc.

## 🎯 Quick Commands to Generate Test Logs

```bash
# Generate donation logs
node stress-test.js donate 5 1

# Generate registration logs
node stress-test.js register 5 1

# Generate campaign logs
node stress-test.js campaigns 5 1

# After running these, check Kibana Discover
# Select each data view to see the filtered logs
```

## 🔍 Example Searches in Kibana

Once data views are created, you can:

### In Donation Logs:
- Filter by campaign: `campaignId: 1`
- Filter by amount: `amount > 50`
- Search text: `"idempotency"`

### In Payment Logs:
- Filter by status: `status: "success"`
- Filter by user: `userEmail: "test@example.com"`

### In Registration Logs:
- Search new users: `"NEW USER REGISTRATION"`
- Filter by email domain: `email: *@gmail.com`

### In Campaign Logs:
- Search cache hits: `"cache hit"`
- Search cache misses: `"cache miss"`

## ✅ Verification

Check if indices are being created:

```bash
# Option 1: Via curl (if available)
curl http://localhost:9200/_cat/indices?v | grep -E "donation|balance|payment|processing|registration|campaign"

# Option 2: In Kibana Dev Tools
# Go to: ☰ menu → Management → Dev Tools
# Run this query:
GET _cat/indices/*-logs-*?v
```

You should see indices like:
- `donation-logs-2025.11.21`
- `balance-logs-2025.11.21`
- `payment-logs-2025.11.21`
- `processing-logs-2025.11.21`
- `registration-logs-2025.11.21`
- `campaign-logs-2025.11.21`

## 📊 Dashboard Ideas

After data views are created, you can build dashboards:

1. **Donation Dashboard:**
   - Visualize donation amounts over time
   - Top campaigns by donation count
   - Donation success vs failure rate

2. **Payment Dashboard:**
   - Payment processing times
   - Payment success rate
   - Failed payment analysis

3. **Registration Dashboard:**
   - New user registrations over time
   - Registration errors
   - User signup patterns

4. **Campaign Dashboard:**
   - Campaign view statistics
   - Cache hit/miss ratios
   - Popular campaigns

## 🎉 Summary

**What was configured:**
- ✅ 6 separate log indices created in filebeat.yml
- ✅ Logs automatically routed based on keywords
- ✅ Step-by-step guide to create data views in Kibana

**Next steps:**
1. Restart filebeat: `docker-compose restart filebeat`
2. Generate test logs with stress-test.js
3. Create data views in Kibana using the steps above
4. View filtered logs in Discover
