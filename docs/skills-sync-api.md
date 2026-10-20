# Skills Sync API — agent 技能库自助推送

技能库（studio 的「技能库」页）的数据在 `public/skills-sync.json`，按 agent
分区。每个 agent 用自己的令牌调这个接口，把**自己那一段**的技能列表整段
替换掉，不用提 PR、不用等审核。其他 agent 的区块原样保留。

- 接口：`POST https://kb-zeta-one.vercel.app/api/skills/push`
- 鉴权：`Authorization: Bearer <你的令牌>`
- 令牌找 **Luna** 领（一人一个，和 agent id 绑定；不要写进任何仓库/公开文件）

## 请求

请求体是 JSON，只有一个字段 `skills`——你这个 agent 的**完整**技能列表
（每次推送都是整段替换，不是增量合并；想删一条就不带它）：

```json
{
  "skills": [
    {
      "id": "my-skill-1",
      "name": "My Skill",
      "zh": "我的技能",
      "tag": "工具",
      "source": "skills/my-skill"
    }
  ]
}
```

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `skills` | array | 是 | 最多 200 条；请求体总量 ≤ 256 KB |
| `skills[].name` | string | 是 | 英文名，非空 |
| `skills[].zh` | string | 是 | 中文名（可与 name 相同） |
| `skills[].tag` | string | 是 | 分类标签，如「工具」「文案」 |
| `skills[].source` | string | 是 | 来源路径/出处 |
| `skills[].id` | string | 否 | 稳定 id；不传时前端按位置自动生成 |

注意：请求体里写任何 agent id 都没用——服务端只认令牌绑定的 agent，
你只能改到自己那一段。

### curl 示例

```bash
curl -X POST https://kb-zeta-one.vercel.app/api/skills/push \
  -H "Authorization: Bearer $SKILLS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"skills":[{"name":"My Skill","zh":"我的技能","tag":"工具","source":"skills/my-skill"}]}'
```

## 响应

| 状态码 | 含义 |
| --- | --- |
| 200 | 成功。返回 `{ ok, agent, skills, updated_at }`；提交已进仓库 main 分支，Vercel 自动部署，约 1 分钟后线上生效 |
| 400 | 请求体不合法：不是 JSON、`skills` 不是数组、超 200 条、字段不是字符串或超长、体积超限 |
| 401 | 没有令牌或令牌不对 |
| 502 | 服务端读写 GitHub 失败，稍后重试 |
| 503 | 接口未配置（服务端环境变量没配好），找 Luna |

## 规则

- 只推自己的完整列表；推送即替换，旧条目不在新列表里即视为删除。
- 推送会产生一条 git 提交（`skills-sync: <agent> pushed N skills`），
  历史可查、推坏了可回滚。
- 令牌只保存在你自己的运行环境里（环境变量或本机私有文件），
  不要提交进仓库、不要发到公开渠道。令牌泄露找 Luna 换。
