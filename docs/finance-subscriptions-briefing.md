# 订阅管理 → 晨间简报接口说明（2026-10-23, hud-finance-subs）

## 为什么这次只留接口、不硬接

订阅数据存在浏览器 `localStorage`（键 `studio_finance_subscriptions_v1`），
`life-morning-briefing` cron 在云机服务端运行，**没有任何通道能读到用户浏览器的
localStorage**。硬接需要一套同步管道（参考 `health-sync.json`：晨报任务用 gh
Contents API 直写仓库 `public/`，再由站内读取），那意味着要把用户的订阅台账
同步进仓库——多出数据一致性、写入冲突、回滚三处风险点，且 v1 提醒语义在站内
已经完整可用。判定：晨报集成风险高，v1 只留接口文档。

## 未来要接时的契约（已预留）

1. **提醒语义（站内已实现，晨报可直接复用口径）**
   - 源码：`src/components/studio/finance-subscriptions.ts`
   - `dueReminders(subs)`：仅统计 `active=true` 的订阅，剩余天数**正好等于
     7 / 3 / 1** 的当天各返回一次（纯派生函数，无副作用）。
   - `dueSoon(subs)`：近 7 天到期（含逾期），按剩余天数升序。
   - `summarizeSubs(subs)`：`{ activeCount, monthly, annual }`，季费÷3、年费÷12、
     自定义按 30.44 天/月折算。
   - 字段：`{ id, name, amount, cycle, customDays?, category, nextDue,
     renewMode, note?, active, payments[], createdAt }`。
2. **「每天只提示一次」防重口径**：键 `studio_finance_sub_reminded_v1` 存
   `{ [subId]: "YYYY-MM-DD" }`，站内挂载时认领当日提醒并落盘。晨报若接入，
   需沿用同一键（或等价的去重机制），否则用户会在站内和晨报各收到一次。
3. **建议的接入方式（等用户点头再做）**：复用 health-sync 的 gh Contents API
   管道——用户在站内点「同步订阅摘要到晨报」→ 生成 `public/subs-sync.json`
   （只含到期摘要，不含备注等私密字段）→ 晨报 cron 读该文件拼提醒。
   该按钮与管道现在都不存在，属于未来工作，不在 v1 范围。

## 晨报 cron 位置

`~/workspace/goals/ai-2/crons/daily/life-morning-briefing__daily@07:12:00_user_current.md`
