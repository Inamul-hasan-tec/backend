-- Keep subscription billing joins stable across imported/default schemas.

ALTER TABLE subscriptions
  MODIFY COLUMN plan VARCHAR(50)
    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    NOT NULL DEFAULT 'starter',
  MODIFY COLUMN status VARCHAR(30)
    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    NOT NULL DEFAULT 'trial',
  MODIFY COLUMN billing_cycle VARCHAR(20)
    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    NOT NULL DEFAULT 'monthly';

ALTER TABLE subscription_plans
  MODIFY COLUMN code VARCHAR(50)
    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    NOT NULL,
  MODIFY COLUMN name VARCHAR(100)
    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    NOT NULL;

ALTER TABLE subscription_orders
  MODIFY COLUMN order_number VARCHAR(40)
    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    NOT NULL,
  MODIFY COLUMN plan_code VARCHAR(50)
    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    NOT NULL;

ALTER TABLE subscription_payments
  MODIFY COLUMN transaction_reference VARCHAR(255)
    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    NOT NULL,
  MODIFY COLUMN proof_url VARCHAR(500)
    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    NULL,
  MODIFY COLUMN rejection_reason VARCHAR(500)
    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    NULL;
