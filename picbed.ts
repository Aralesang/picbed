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
    await Deno.writeFile(filePath, new Uint8Array(await file.arrayBuffer()));

    // 返回外链
    const url = `http://${req.headers.get("host")}/${randomId}.${fileExtension}`;
    return new Response(JSON.stringify({ status: 200, url }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });

  } catch (error) {
    console.error("Upload error:", error);
    return new Response("Server Error", { status: 500, headers: { "Access-Control-Allow-Origin": "*" } });
  }
}

// 处理下载并删除
async function handleDownload(id: string): Promise<Response> {
  const filePath = `${CONFIG.uploadDir}/${id}`;
  try {
    const file = await Deno.readFile(filePath);
    return new Response(file, {
      headers: { "Content-Type": "image/jpeg", "Access-Control-Allow-Origin": "*" }, // 自动识别类型可自行扩展
    });
  } catch {
    return new Response("File not found", { status: 404, headers: { "Access-Control-Allow-Origin": "*" } });
  }
}

// 处理静态文件
async function handleStaticFile(pathname: string): Promise<Response> {
  try {
    const filePath = `./public${pathname}`;
    const file = await Deno.readFile(filePath);
    const contentType = pathname.endsWith('.html') ? 'text/html' :
      pathname.endsWith('.css') ? 'text/css' :
        pathname.endsWith('.js') ? 'application/javascript' :
          'application/octet-stream';

    return new Response(file, {
      headers: { "Content-Type": `${contentType}; charset=utf-8`, "Access-Control-Allow-Origin": "*" },
    });
  } catch {
    return new Response("File not found", { status: 404, headers: { "Access-Control-Allow-Origin": "*" } });
  }
}

// 启动服务
Deno.serve({
  port: CONFIG.port,
  handler(req: Request) {
    const url = new URL(req.url);

    // 路由处理
    if (req.method === "POST" && url.pathname === "/upload") {
      return handleUpload(req);
    } else if (req.method === "GET") {
      // 处理根路径请求
      if (url.pathname === "/" || url.pathname === "/index.html") {
        return handleStaticFile("/index.html");
      }
      // 处理静态文件
      if (url.pathname.startsWith("/static/")) {
        return handleStaticFile(url.pathname);
      }
      // 处理图片下载
      return handleDownload(url.pathname.slice(1));
    }

    return new Response("Not Found", { status: 404, headers: { "Access-Control-Allow-Origin": "*" } });
  },
});

// 初始化目录
await Deno.mkdir(CONFIG.uploadDir, { recursive: true });


//自动删除文件
function autoDelete() {
  //删除间隔(秒)
  const lastTime = 10 * 60 * 1000;
  const delete_file = async () => {
    //获取文件名称列表
    const files = await Deno.readDir(CONFIG.uploadDir);
    //文件名称用字符_分割，前面是随机字符，后面是创建时间，扫描全部文件，对比当前时间,删除超过删除间隔的文件
    for await (const file of files) {
      const fileName = file.name;
      const fileTime = fileName.split('_')[1].split('.')[0];
      const nowTime = Date.now();
      if (nowTime - Number(fileTime) > lastTime) {
        //删除文件
        await Deno.remove(`${CONFIG.uploadDir}/${fileName}`);
        console.log(`删除文件${fileName}`);
      }
    }
  }
  //启动时立即调用一次
  delete_file();
  //每十分钟检查一次
  setInterval(async () => {
    await delete_file();
  }, lastTime);
}

autoDelete();

console.log(`Server running at http://localhost:${CONFIG.port}`);