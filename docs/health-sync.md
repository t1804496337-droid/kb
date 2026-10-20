# health-sync.json —— 健康数据下发格式

「身体健康」模块的睡眠 / 步数 / 体重 / 饮食建议走同步文件路线（同 works-sync、skills-sync）：
Luna 侧定时（晨间）读手机健康数据（Apple Health 等连接器）→ 生成本文件 →
放到站点 `public/health-sync.json` → 健康模块 fetch 渲染。文件缺失 / 404 时模块显示
「数据待同步」空态，不报错、不编数据。

**诚实边界**：数据新鲜度取决于用户手机向健康 App 的同步进度。模块会显示
`updated_at` 与「数据截至」字样，不装实时。已知有过同步断档（最近一次完整睡眠
记录停在 2026-10-17 周六晚），Luna 在晨间简报里盯断档并提醒。

## 字段格式

```jsonc
{
  // 下发时间（ISO 8601 带时区），模块据此显示「数据截至」
  "updated_at": "2026-10-20T08:00:00+08:00",
  "sleep": {
    // 最近一晚完整睡眠；无记录时为 null
    "last": {
      "date": "2026-10-17",   // 入睡日期（晚间日期）
      "start": "22:22",       // 入睡时间 HH:MM
      "end": "03:28",         // 起床时间 HH:MM（次日）
      "hours": 5.08           // 时长（小时，小数）
    },
    // 近 7 天睡眠时长；只有几天就放几天，缺的天不要编
    "last7": [{ "date": "2026-10-17", "hours": 5.08 }]
  },
  // 步数：today = 今日步数，avg7 = 近 7 天日均；无数据填 null
  "steps": { "today": null, "avg7": null },
  // 最近体重（kg）；无数据填 null
  "weight_kg": null,
  "diet": {
    // 蛋白目标（计划口径：每公斤体重 1.2–1.6g）
    "protein_target": "1.2–1.6 g/kg",
    // 当日饮食建议 1 条，由 Luna 按计划原则生成，措辞克制、不做医疗断言
    "advice": "先把蛋白吃够（每公斤体重 1.2–1.6g），训练日主食别省……",
    // 最近一次拍照分析结果；没有就填 null。
    // 拍照分析目前走聊天回路：用户在聊天里发食物图给 Luna → Luna 估热量/蛋白
    // → 回填这里 { "date": "YYYY-MM-DD", "summary": "…" } 在模块展示。
    "last_analysis": null
  }
}
```

## 下发方式

1. Luna 晨间任务读健康连接器，组装成上面的 JSON（只写真实读到的数据，缺项填 null / 空数组）。
2. 覆盖仓库 `public/health-sync.json` 并提交到 main（或后续经与 skills-api 同类的推送通道），
   Vercel 自动部署后模块下次打开即渲染新数据。
3. 当前仓库里的 `public/health-sync.json` 是首份真实快照：只有 2026-10-17 晚一条完整
   睡眠（22:22 → 03:28，5 小时 05 分），步数 / 体重为 null —— 这是真实状态，不要为了好看补数。

## 相关文件

- 模块实现：`src/components/studio/health-module.tsx`
- 教学媒体映射：`public/health-media.json`（键 = 动作 id，值 {title, embed?, link, source, type?}；
  embed 为 B站播放器地址，type:"article" 表示只有图文链接、无内嵌）
- 打卡数据：浏览器 localStorage `studio_health_checkins_v1`（日期数组），不走本文件；
  健康模块全站计数口径 = 累计打卡天数。
