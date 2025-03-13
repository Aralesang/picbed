// 创建必要的目录
await Deno.mkdir("./public", { recursive: true });
await Deno.mkdir("./tmp_images", { recursive: true });

console.log("目录创建完成！");
