// 配置项
const CONFIG = {
  port: 8000,
  uploadDir: "./tmp_images",
  maxSize: 5 * 1024 * 1024, // 5MB
  idLength: 12, // 随机ID长度
};

// 生成随机ID (替代第三方库)
function generateRandomId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const cryptoArray = new Uint8Array(CONFIG.idLength);
  crypto.getRandomValues(cryptoArray);
  return Array.from(cryptoArray, byte => chars[byte % chars.length]).join('');
}

//记录所有生成的文件名和时间戳
const fileMap = new Map();

// 处理上传
async function handleUpload(req: Request): Promise<Response> {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    //console.log(formData, file);

    // 验证文件类型和大小
    if (!file || !file.type.startsWith("image/")) {
      console.log("错误，不是图片");

      return new Response("仅限以下文件类型: JPEG/PNG/GIF", { status: 400 });
    }
    if (file.size > CONFIG.maxSize) {
      console.log("错误，图片大小超过上限");

      return new Response(`文件大小不能超过 ${CONFIG.maxSize / 1024 / 1024}MB!`, { status: 400 });
    }

    //console.log("开始 写入文件");
    //获取文件后缀名
    const fileExtension = file.name.split('.').pop();
    //console.log(fileExtension);

    // 保存文件
    const randomId = `${generateRandomId()}_${Date.now()}`;
    const filePath = `${CONFIG.uploadDir}/${randomId}.${fileExtension}`;
    fileMap.set(randomId + "." + fileExtension, Date.now());
    await Deno.writeFile(filePath, new Uint8Array(await file.arrayBuffer()));

    // 返回外链
    const url = `http://${req.headers.get("host")}/${randomId}.${fileExtension}`;
    return Response.json({ status: 200, url });

  } catch (error) {
    console.error("Upload error:", error);
    return new Response("Server Error", { status: 500 });
  }
}

// 处理下载并删除
async function handleDownload(id: string): Promise<Response> {
  const filePath = `${CONFIG.uploadDir}/${id}`;
  try {
    const file = await Deno.readFile(filePath);
    return new Response(file, {
      headers: { "Content-Type": "image/jpeg" }, // 自动识别类型可自行扩展
    });
  } catch {
    return new Response("File not found", { status: 404 });
  }
}

// 启动服务
Deno.serve({
  port: CONFIG.port,
  async handler(req: Request) {
    const url = new URL(req.url);
    //sconsole.log(req);
    // 路由处理
    if (req.method === "POST" && url.pathname === "/upload") {
      //console.log("开始处理上传");

      return handleUpload(req);
    } else if (req.method === "GET" && url.pathname !== "/upload") {
      return handleDownload(url.pathname.slice(1)); // 提取ID
    }

    return new Response("Not Found", { status: 404 });
  },
});

// 初始化目录
await Deno.mkdir(CONFIG.uploadDir, { recursive: true });
//启动时删除所有temp_images下的文件
for await (const entry of Deno.readDir(CONFIG.uploadDir)) {
  const filePath = `${CONFIG.uploadDir}/${entry.name}`;
  try {
    const file = await Deno.readFile(filePath);
    await Deno.remove(filePath);
  } catch {
    console.log("File not found");
  }
}

//每十分钟检查一次所有记录的文件名称和时间戳，并删除其中超过十分钟的
setInterval(async () => {
  for (const [key, value] of fileMap) {
    if (Date.now() - value > 10 * 60 * 1000) {
      fileMap.delete(key);
      const filePath = `${CONFIG.uploadDir}/${key}`;
      try {
        const file = await Deno.readFile(filePath);
        await Deno.remove(filePath);
      } catch {
        console.log("File not found");
      }
    }
  }
}, 10 * 60 * 1000);

console.log(`Server running at http://localhost:${CONFIG.port}`);