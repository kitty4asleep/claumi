import { Server } from “@modelcontextprotocol/sdk/server/index.js”;
import { StdioServerTransport } from “@modelcontextprotocol/sdk/server/stdio.js”;
import { createClient } from ‘@supabase/supabase-js’;

// 从环境变量获取Supabase配置
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
console.error(‘请设置 SUPABASE_URL 和 SUPABASE_KEY 环境变量’);
process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// 创建MCP服务器
const server = new Server(
{
name: “memory-server”,
version: “1.0.0”,
},
{
capabilities: {
tools: {},
},
}
);

// 工具1：保存记忆
server.setRequestHandler(“tools/list”, async () => {
return {
tools: [
{
name: “save_memory”,
description: “保存一条记忆到数据库”,
inputSchema: {
type: “object”,
properties: {
content: {
type: “string”,
description: “要保存的记忆内容”
},
tags: {
type: “array”,
items: { type: “string” },
description: “记忆标签（可选）”
}
},
required: [“content”]
}
},
{
name: “search_memory”,
description: “搜索记忆”,
inputSchema: {
type: “object”,
properties: {
query: {
type: “string”,
description: “搜索关键词”
},
limit: {
type: “number”,
description: “返回结果数量，默认10”
}
},
required: [“query”]
}
},
{
name: “get_time”,
description: “获取当前时间”,
inputSchema: {
type: “object”,
properties: {}
}
},
{
name: “list_recent_memories”,
description: “列出最近的记忆”,
inputSchema: {
type: “object”,
properties: {
limit: {
type: “number”,
description: “返回结果数量，默认20”
}
}
}
}
]
};
});

// 工具执行
server.setRequestHandler(“tools/call”, async (request) => {
const { name, arguments: args } = request.params;

try {
switch (name) {
case “save_memory”: {
const { content, tags = [] } = args;
const { data, error } = await supabase
.from(‘memories’)
.insert({
content,
tags,
created_at: new Date().toISOString()
})
.select();

```
    if (error) throw error;

    return {
      content: [{
        type: "text",
        text: `记忆已保存！ID: ${data[0].id}`
      }]
    };
  }

  case "search_memory": {
    const { query, limit = 10 } = args;
    const { data, error } = await supabase
      .from('memories')
      .select('*')
      .ilike('content', `%${query}%`)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    const results = data.map(m => 
      `[${m.created_at}] ${m.content}${m.tags?.length ? ` (标签: ${m.tags.join(', ')})` : ''}`
    ).join('\n\n');

    return {
      content: [{
        type: "text",
        text: results || "没有找到相关记忆"
      }]
    };
  }

  case "get_time": {
    const now = new Date();
    return {
      content: [{
        type: "text",
        text: `当前时间：${now.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}\nISO格式：${now.toISOString()}`
      }]
    };
  }

  case "list_recent_memories": {
    const { limit = 20 } = args;
    const { data, error } = await supabase
      .from('memories')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    const results = data.map(m => 
      `[${m.created_at}] ${m.content}${m.tags?.length ? ` (标签: ${m.tags.join(', ')})` : ''}`
    ).join('\n\n');

    return {
      content: [{
        type: "text",
        text: results || "暂无记忆"
      }]
    };
  }

  default:
    throw new Error(`未知工具: ${name}`);
}
```

} catch (error) {
return {
content: [{
type: “text”,
text: `错误: ${error.message}`
}],
isError: true
};
}
});

// 启动服务器
async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error(“MCP记忆服务器已启动”);
}

main().catch((error) => {
console.error(“服务器启动失败:”, error);
process.exit(1);
});
