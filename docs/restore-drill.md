# 恢复演练记录

- 日期：2026-09-20（UTC+8 20:4x）
- 备份文件：`/srv/stack/backups/db/daily/personal_stack-2026-09-20.sql.gz`（2.4 KB，含 users/posts/files/folders/tags/post_tags 与 alembic_version）
- 脚本：`deploy/ops/backup/restore.sh`

## 数据库恢复（恢复到独立库 `personal_stack_restore`，未触碰生产库）

| 表 | 生产行数 | 恢复行数 |
|---|---|---|
| users | 1 | 1 |
| posts | 1 | 1 |
| files | 0 | 0 |
| folders | 1 | 1 |
| tags | 1 | 1 |

结论：行数全部一致；恢复完成后已删除演练库。

## 文件恢复

- 方法：在 `/srv/stack/data/files/drill/verify.bin` 放 1MB 随机文件 → `backup-files.sh` 同步 → `restore.sh --files` 恢复到 `/tmp/restore-verify` → 校验 sha256
- 结果：源与恢复文件哈希一致（`a8671659a02fb918a28cab7d28b21e01ca27a2a16eda529c2e0d1779b692dd57`），演练后清理临时文件

## 结论与后续

- 备份与恢复链路可用；daily/weekly 保留策略生效（本次为周日，已生成周备副本）。
- 备份与数据同盘，仅防误删/损坏，**不防磁盘故障**；异地备份（restic 推对象存储）列为二期。
- 建议每季度复跑一次本演练；备份产物权限为 600（仅 root）。
