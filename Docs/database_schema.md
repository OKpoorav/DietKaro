# DietConnect Database Schema (Production-Ready)

## Table Definitions

### Organizations (Tenants)
```sql
CREATE TABLE Organization (
  org_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  logo_url TEXT,
  phone VARCHAR(20),
  email VARCHAR(255),
  address TEXT,
  city VARCHAR(100),
  country VARCHAR(100) DEFAULT 'IN',
  timezone VARCHAR(50) DEFAULT 'Asia/Kolkata',
  subscription_tier VARCHAR(50) DEFAULT 'free', -- free/pro/clinic/enterprise
  subscription_status VARCHAR(50) DEFAULT 'active', -- active/paused/cancelled
  subscription_expires_at TIMESTAMP,
  max_clients INT DEFAULT 10,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true
);

CREATE INDEX idx_org_subscription_status ON Organization(subscription_status);
CREATE INDEX idx_org_is_active ON Organization(is_active);
```

### Users (Dietitians/Admins)
```sql
CREATE TABLE "User" (
  user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES Organization(org_id) ON DELETE CASCADE,
  clerk_user_id VARCHAR(255) UNIQUE,
  role VARCHAR(50) NOT NULL, -- owner/admin/dietitian
  email VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  profile_photo_url TEXT,
  license_number VARCHAR(100),
  specialization VARCHAR(255),
  bio TEXT,
  mfa_enabled BOOLEAN DEFAULT false,
  last_login_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  UNIQUE(org_id, email)
);

CREATE INDEX idx_user_org_id ON "User"(org_id);
CREATE INDEX idx_user_clerk_id ON "User"(clerk_user_id);
CREATE INDEX idx_user_role ON "User"(role);
```

### Clients
```sql
CREATE TABLE Client (
  client_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES Organization(org_id) ON DELETE CASCADE,
  primary_dietitian_id UUID NOT NULL REFERENCES "User"(user_id),
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  date_of_birth DATE,
  gender VARCHAR(20), -- male/female/other
  profile_photo_url TEXT,
  height_cm DECIMAL(5,2),
  current_weight_kg DECIMAL(5,2),
  target_weight_kg DECIMAL(5,2),
  activity_level VARCHAR(50), -- sedentary/lightly_active/moderately_active/very_active
  dietary_preferences TEXT[], -- array of strings
  allergies TEXT[],
  medical_conditions TEXT[],
  medications TEXT[],
  health_notes TEXT,
  emergency_contact_name VARCHAR(255),
  emergency_contact_phone VARCHAR(20),
  onboarding_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP,
  created_by_user_id UUID,
  is_active BOOLEAN DEFAULT true,
  UNIQUE(org_id, email)
);

CREATE INDEX idx_client_org_id ON Client(org_id);
CREATE INDEX idx_client_primary_dietitian ON Client(primary_dietitian_id);
CREATE INDEX idx_client_status ON Client(is_active);
```

### Medical Profile
```sql
CREATE TABLE MedicalProfile (
  medical_profile_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL UNIQUE REFERENCES Client(client_id) ON DELETE CASCADE,
  diagnoses TEXT[],
  allergies TEXT[],
  intolerances TEXT[],
  medications TEXT[],
  supplements TEXT[],
  surgeries TEXT[],
  family_history TEXT,
  health_notes TEXT,
  dietary_restrictions TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  updated_by_user_id UUID
);

CREATE INDEX idx_medical_profile_client_id ON MedicalProfile(client_id);
```

### Diet Plans
```sql
CREATE TABLE DietPlan (
  plan_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES Organization(org_id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES Client(client_id) ON DELETE CASCADE,
  created_by_user_id UUID NOT NULL REFERENCES "User"(user_id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE,
  target_calories INT,
  target_protein_g DECIMAL(5,1),
  target_carbs_g DECIMAL(5,1),
  target_fats_g DECIMAL(5,1),
  target_fiber_g DECIMAL(5,1),
  notes_for_client TEXT,
  internal_notes TEXT,
  status VARCHAR(50) DEFAULT 'draft', -- draft/active/completed/paused
  is_template BOOLEAN DEFAULT false,
  template_category VARCHAR(100),
  visibility VARCHAR(50) DEFAULT 'private', -- private/org_shared/public
  published_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true
);

CREATE INDEX idx_diet_plan_org_id ON DietPlan(org_id);
CREATE INDEX idx_diet_plan_client_id ON DietPlan(client_id);
CREATE INDEX idx_diet_plan_status ON DietPlan(status);
CREATE INDEX idx_diet_plan_is_template ON DietPlan(is_template);
```

### Meals
```sql
CREATE TABLE Meal (
  meal_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES DietPlan(plan_id) ON DELETE CASCADE,
  day_of_week INT, -- 1-7 (Monday-Sunday)
  meal_date DATE,
  sequence_number INT,
  meal_type VARCHAR(50) NOT NULL, -- breakfast/lunch/snack/dinner
  time_of_day VARCHAR(10), -- "08:00" format
  name VARCHAR(255) NOT NULL,
  description TEXT,
  instructions TEXT,
  serving_size_notes TEXT,
  total_calories INT,
  total_protein_g DECIMAL(5,1),
  total_carbs_g DECIMAL(5,1),
  total_fats_g DECIMAL(5,1),
  total_fiber_g DECIMAL(5,1),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_meal_plan_id ON Meal(plan_id);
CREATE INDEX idx_meal_date ON Meal(meal_date);
```

### Food Items (Global + Org-Specific)
```sql
CREATE TABLE FoodItem (
  food_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID, -- NULL = global food, else org-specific
  name VARCHAR(255) NOT NULL,
  brand VARCHAR(255),
  category VARCHAR(100) NOT NULL,
  sub_category VARCHAR(100),
  serving_size_g DECIMAL(6,2) DEFAULT 100,
  calories INT NOT NULL,
  protein_g DECIMAL(5,1),
  carbs_g DECIMAL(5,1),
  fats_g DECIMAL(5,1),
  fiber_g DECIMAL(5,1),
  sodium_mg DECIMAL(7,2),
  sugar_g DECIMAL(5,1),
  is_verified BOOLEAN DEFAULT false,
  source VARCHAR(100), -- USDA/user_submitted/industry
  barcode VARCHAR(50),
  allergen_flags TEXT[],
  dietary_tags TEXT[], -- vegan/vegetarian/organic/etc
  created_by_user_id UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_food_org_id ON FoodItem(org_id);
CREATE INDEX idx_food_category ON FoodItem(category);
CREATE INDEX idx_food_name ON FoodItem(name);
```

### Meal Food Items (Junction Table)
```sql
CREATE TABLE MealFoodItem (
  meal_food_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_id UUID NOT NULL REFERENCES Meal(meal_id) ON DELETE CASCADE,
  food_id UUID NOT NULL REFERENCES FoodItem(food_id) ON DELETE CASCADE,
  quantity_g DECIMAL(6,2) NOT NULL,
  calories INT,
  protein_g DECIMAL(5,1),
  carbs_g DECIMAL(5,1),
  fats_g DECIMAL(5,1),
  fiber_g DECIMAL(5,1),
  sort_order INT DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_meal_food_item_meal_id ON MealFoodItem(meal_id);
CREATE INDEX idx_meal_food_item_food_id ON MealFoodItem(food_id);
```

### Meal Logs (Tracking)
```sql
CREATE TABLE MealLog (
  meal_log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES Organization(org_id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES Client(client_id) ON DELETE CASCADE,
  meal_id UUID NOT NULL REFERENCES Meal(meal_id) ON DELETE CASCADE,
  scheduled_date DATE NOT NULL,
  scheduled_time VARCHAR(10), -- "08:00"
  status VARCHAR(50) DEFAULT 'pending', -- pending/eaten/skipped/substituted
  meal_photo_url TEXT,
  meal_photo_small_url TEXT,
  photo_uploaded_at TIMESTAMP,
  ai_food_recognition JSONB, -- AI analysis results
  client_notes TEXT,
  dietitian_feedback TEXT,
  dietitian_feedback_at TIMESTAMP,
  reviewed_by_user_id UUID REFERENCES "User"(user_id),
  substitute_description TEXT,
  substitute_calories_est INT,
  logged_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_meal_log_org_id ON MealLog(org_id);
CREATE INDEX idx_meal_log_client_id ON MealLog(client_id);
CREATE INDEX idx_meal_log_scheduled_date ON MealLog(scheduled_date);
CREATE INDEX idx_meal_log_status ON MealLog(status);
```

### Weight Logs
```sql
CREATE TABLE WeightLog (
  weight_log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES Organization(org_id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES Client(client_id) ON DELETE CASCADE,
  weight_kg DECIMAL(5,2) NOT NULL,
  log_date DATE NOT NULL,
  log_time VARCHAR(10), -- "10:00"
  notes TEXT,
  progress_photo_url TEXT,
  bmi DECIMAL(4,2),
  weight_change_from_previous DECIMAL(5,2),
  is_outlier BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(client_id, log_date)
);

CREATE INDEX idx_weight_log_org_id ON WeightLog(org_id);
CREATE INDEX idx_weight_log_client_id ON WeightLog(client_id);
CREATE INDEX idx_weight_log_log_date ON WeightLog(log_date);
```

### Body Measurements
```sql
CREATE TABLE BodyMeasurement (
  measurement_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES Organization(org_id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES Client(client_id) ON DELETE CASCADE,
  log_date DATE NOT NULL,
  chest_cm DECIMAL(5,2),
  waist_cm DECIMAL(5,2),
  hips_cm DECIMAL(5,2),
  thighs_cm DECIMAL(5,2),
  arms_cm DECIMAL(5,2),
  body_fat_percentage DECIMAL(4,2),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_body_measurement_org_id ON BodyMeasurement(org_id);
CREATE INDEX idx_body_measurement_client_id ON BodyMeasurement(client_id);
```

### Session Notes (SOAP/DAP)
```sql
CREATE TABLE SessionNote (
  note_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES Organization(org_id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES Client(client_id) ON DELETE CASCADE,
  created_by_user_id UUID NOT NULL REFERENCES "User"(user_id),
  note_type VARCHAR(50) NOT NULL, -- SOAP/DAP/other
  title VARCHAR(255) NOT NULL,
  subjective TEXT,
  objective TEXT,
  assessment TEXT,
  plan TEXT,
  internal_notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP
);

CREATE INDEX idx_session_note_org_id ON SessionNote(org_id);
CREATE INDEX idx_session_note_client_id ON SessionNote(client_id);
```

### Notifications
```sql
CREATE TABLE Notification (
  notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID NOT NULL,
  recipient_type VARCHAR(50) NOT NULL, -- 'user' or 'client'
  org_id UUID NOT NULL REFERENCES Organization(org_id) ON DELETE CASCADE,
  type VARCHAR(100) NOT NULL, -- meal_reminder/photo_uploaded/feedback_received
  category VARCHAR(100),
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  icon VARCHAR(100),
  deep_link TEXT,
  related_entity_type VARCHAR(100),
  related_entity_id UUID,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMP,
  sent_via_channels TEXT[] DEFAULT ARRAY['push'], -- push/email/in-app
  delivery_status VARCHAR(50) DEFAULT 'pending', -- pending/delivered/failed
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '30 days'
);

CREATE INDEX idx_notification_recipient ON Notification(recipient_id, recipient_type);
CREATE INDEX idx_notification_is_read ON Notification(is_read);
CREATE INDEX idx_notification_org_id ON Notification(org_id);
```

### Activity Logs (Audit Trail)
```sql
CREATE TABLE ActivityLog (
  activity_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES Organization(org_id) ON DELETE CASCADE,
  user_id UUID REFERENCES "User"(user_id),
  user_type VARCHAR(50), -- 'dietitian', 'client', 'admin'
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100),
  entity_id UUID,
  old_values JSONB,
  new_values JSONB,
  change_desc TEXT,
  ip_address VARCHAR(50),
  user_agent TEXT,
  status VARCHAR(50) DEFAULT 'success', -- success/failed/warning
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_activity_log_org_id ON ActivityLog(org_id);
CREATE INDEX idx_activity_log_user_id ON ActivityLog(user_id);
CREATE INDEX idx_activity_log_action ON ActivityLog(action);
```

### Invoices
```sql
CREATE TABLE Invoice (
  invoice_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES Organization(org_id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES Client(client_id) ON DELETE CASCADE,
  created_by_user_id UUID NOT NULL REFERENCES "User"(user_id),
  invoice_number VARCHAR(50) NOT NULL UNIQUE,
  issue_date DATE NOT NULL,
  due_date DATE NOT NULL,
  currency VARCHAR(10) DEFAULT 'INR',
  subtotal DECIMAL(10,2) NOT NULL,
  tax DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) NOT NULL,
  status VARCHAR(50) DEFAULT 'unpaid', -- unpaid/sent/paid/cancelled
  notes TEXT,
  sent_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_invoice_org_id ON Invoice(org_id);
CREATE INDEX idx_invoice_client_id ON Invoice(client_id);
CREATE INDEX idx_invoice_status ON Invoice(status);
```

---

## Summary: 15 Tables 

| Table | Purpose | Records (1yr) |
|-------|---------|---------------|
| Organization | Tenants | 1 |
| User | Dietitians/admins | 50 |
| Client | Clients | 500 |
| MedicalProfile | Medical history | 500 |
| DietPlan | Meal plans | 2,000 |
| Meal | Individual meals | 7,000 |
| FoodItem | Global + org foods | 10,000 |
| MealFoodItem | Meal compositions | 28,000 |
| MealLog | Tracked meals | 30,000 |
| WeightLog | Weight entries | 5,000 |
| BodyMeasurement | Measurement history | 2,000 |
| SessionNote | SOAP notes | 5,000 |
| Notification | Push alerts | 50,000 |
| ActivityLog | Audit trail | 100,000 |
| Invoice | Billing | 1,000 |
| **TOTAL** | | **241,050** |

---

