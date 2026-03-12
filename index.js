import { Server } from “@modelcontextprotocol/sdk/server/index.js”;
import { SSEServerTransport } from “@modelcontextprotocol/sdk/server/sse.js”;
import { createClient } from “@supabase/supabase-js”;
import express from “express”;

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const PORT = process.env.PORT || 3000;

if (!supabaseUrl || !supabaseKey) {
console.error(“Please set SUPABASE_URL and SUPABASE_KEY”);
process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const app = express();

app.get(”/sse”, async (req, res) => {
console.log(“SSE connection request received”);

const transport = new SSEServerTransport(”/message”, res);
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

server.setRequestHandler(“tools/list”, async () => {
return {
tools: [
{
name: “save_memory”,
description: “Save a memory to database”,
inputSchema: {
type: “object”,
properties: {
content: {
type: “string”,
description: “Memory content”
},
tags: {
type: “array”,
items: { type: “string” },
description: “Memory tags”
}
},
required: [“content”]
}
},
{
name: “search_memory”,
description: “Search memories”,
inputSchema: {
type: “object”,
properties: {
query: {
type: “string”,
description: “Search query”
},
limit: {
type: “number”,
description: “Result limit”
}
},
required: [“query”]
}
},
{
name: “get_time”,
description: “Get current time”,
inputSchema: {
type: “object”,
properties: {}
}
},
{
name: “list_recent_memories”,
description: “List recent memories”,
inputSchema: {
type: “object”,
properties: {
limit: {
type: “number”,
description: “Result limit”
}
}
}
}
]
};
});

server.setRequestHandler(“tools/call”, async (request) => {
const { name, arguments: args } = request.params;

```
try {
  switch (name) {
    case "save_memory": {
      const { content, tags = [] } = args;
      const { data, error } = await supabase
        .from("memories")
        .insert({
          content,
          tags,
          created_at: new Date().toISOString()
        })
        .select();

      if (error) throw error;

      return {
        content: [{
          type: "text",
          text: `Memory saved! ID: ${data[0].id}`
        }]
      };
    }

    case "search_memory": {
      const { query, limit = 10 } = args;
      const { data, error } = await supabase
        .from("memories")
        .select("*")
        .ilike("content", `%${query}%`)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;

      const results = data.map(m => 
        `[${m.created_at}] ${m.content}${m.tags?.length ? ` (tags: ${m.tags.join(", ")})` : ""}`
      ).join("\n\n");

      return {
        content: [{
          type: "text",
          text: results || "No memories found"
        }]
      };
    }

    case "get_time": {
      const now = new Date();
      return {
        content: [{
          type: "text",
          text: `Current time: ${now.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}\nISO: ${now.toISOString()}`
        }]
      };
    }

    case "list_recent_memories": {
      const { limit = 20 } = args;
      const { data, error } = await supabase
        .from("memories")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;

      const results = data.map(m => 
        `[${m.created_at}] ${m.content}${m.tags?.length ? ` (tags: ${m.tags.join(", ")})` : ""}`
      ).join("\n\n");

      return {
        content: [{
          type: "text",
          text: results || "No memories yet"
        }]
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
} catch (error) {
  return {
    content: [{
      type: "text",
      text: `Error: ${error.message}`
    }],
    isError: true
  };
}
```

});

await server.connect(transport);
console.log(“MCP server connected”);
});

app.post(”/message”, express.json(), async (req, res) => {
res.status(200).end();
});

app.get(”/”, (req, res) => {
res.json({
status: “ok”,
message: “MCP memory server is running”,
endpoints: {
sse: “/sse”,
message: “/message”
}
});
});

app.listen(PORT, () => {
console.log(`MCP memory server started on port ${PORT}`);
});
