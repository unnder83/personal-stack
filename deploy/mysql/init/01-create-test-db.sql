CREATE DATABASE IF NOT EXISTS personal_stack_test
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON personal_stack_test.* TO 'app'@'%';
FLUSH PRIVILEGES;
