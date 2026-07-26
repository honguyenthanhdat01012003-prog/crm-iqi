/**
 * Inventory ask helpers: GPT intent parse → DB filters.
 * Used by /api/inventory/search and /api/inventory/ask
 */

export function mapInventoryUnitApi(u) {
  return {
    id: u.id,
    projectId: u.project_id,
    sourceId: u.source_id,
    source: u.source_code || "",
    unitCode: u.unit_code || "",
    building: u.building || "",
    floor: u.floor || "",
    unitNo: u.unit_no || "",
    unitType: u.unit_type || "",
    layout: u.layout || "",
    direction: u.direction || "",
    view: u.view_text || "",
    areaNet: u.area_net || 0,
    areaGross: u.area_gross || 0,
    price: u.price || 0,
    priceLabel: u.price_label || "",
    driveUrl: u.drive_url || "",
    status: u.status || "",
    updatedAt: u.updated_at || "",
  };
}

export async function searchInventoryUnits(db, { all, getUserProjectIds }, user, filters = {}) {
  const q = String(filters.q || "").trim();
  const projectId = filters.projectId && filters.projectId !== "all" ? Number(filters.projectId) : 0;
  const sourceCode = String(filters.source || "").trim().toUpperCase();
  const layout = String(filters.layout || filters.type || "").trim();
  const building = String(filters.building || "").trim();
  const direction = String(filters.direction || "").trim();
  const view = String(filters.view || "").trim();
  const unitCode = String(filters.unitCode || "").trim();
  const minPrice = Number(filters.minPrice) > 0 ? Number(filters.minPrice) : 0;
  const maxPrice = Number(filters.maxPrice) > 0 ? Number(filters.maxPrice) : 0;
  const hasDrive = !!filters.hasDrive;
  const limit = Math.min(50, Math.max(1, parseInt(filters.limit, 10) || 20));
  const sort = String(filters.sort || "price_asc").toLowerCase();

  let allowedPids = null;
  if (user.role === "manager" || user.role === "sale") {
    allowedPids = await getUserProjectIds(user.userId);
    if (!allowedPids.length) return { units: [], total: 0 };
  }

  const where = ["1=1"];
  const params = [];
  if (projectId) {
    if (allowedPids && !allowedPids.includes(projectId)) {
      const err = new Error("Không có quyền dự án");
      err.status = 403;
      throw err;
    }
    where.push("u.project_id = ?");
    params.push(projectId);
  } else if (allowedPids) {
    where.push(`u.project_id IN (${allowedPids.map(() => "?").join(",")})`);
    params.push(...allowedPids);
  }
  if (sourceCode) { where.push("UPPER(u.source_code) = ?"); params.push(sourceCode); }
  if (layout) { where.push("(u.layout LIKE ? OR u.unit_type LIKE ?)"); params.push(`%${layout}%`, `%${layout}%`); }
  if (building) { where.push("LOWER(u.building) LIKE ?"); params.push(`%${building.toLowerCase()}%`); }
  if (direction) { where.push("LOWER(u.direction) LIKE ?"); params.push(`%${direction.toLowerCase()}%`); }
  if (view) { where.push("LOWER(u.view_text) LIKE ?"); params.push(`%${view.toLowerCase()}%`); }
  if (unitCode) { where.push("LOWER(u.unit_code) LIKE ?"); params.push(`%${unitCode.toLowerCase()}%`); }
  if (minPrice) { where.push("u.price >= ?"); params.push(minPrice); }
  if (maxPrice) { where.push("u.price > 0 AND u.price <= ?"); params.push(maxPrice); }
  if (hasDrive) { where.push("u.drive_url IS NOT NULL AND TRIM(u.drive_url) != ''"); }

  if (q && !unitCode) {
    const tokens = [];
    const codeMatches = q.match(/\b[A-Za-z]{1,4}\d{2,6}[A-Za-z]?\b/g) || [];
    tokens.push(...codeMatches.map((t) => t.toLowerCase()));
    const stop = new Set(["gia", "giá", "can", "căn", "cua", "của", "cho", "xem", "tim", "tìm", "bao", "nhieu", "nhiều", "la", "là"]);
    for (const w of q.toLowerCase().split(/[\s,.;:!?/\\-]+/).filter(Boolean)) {
      if (w.length >= 2 && !stop.has(w)) tokens.push(w);
    }
    const uniq = [...new Set(tokens)];
    if (uniq.length) {
      const ors = uniq.map(() => "(LOWER(u.unit_code) LIKE ? OR LOWER(u.building) LIKE ? OR LOWER(u.layout) LIKE ? OR LOWER(u.direction) LIKE ? OR LOWER(u.view_text) LIKE ? OR LOWER(u.source_code) LIKE ?)").join(" OR ");
      where.push(`(${ors})`);
      for (const t of uniq) {
        const like = `%${t}%`;
        params.push(like, like, like, like, like, like);
      }
    }
  }

  let orderBy = "u.price ASC, u.unit_code ASC";
  if (sort === "price_desc") orderBy = "u.price DESC, u.unit_code ASC";
  else if (sort === "code") orderBy = "u.unit_code ASC";

  const sql = `SELECT u.*, p.name as project_name FROM inventory_units u
    LEFT JOIN projects p ON p.id = u.project_id
    WHERE ${where.join(" AND ")}
    ORDER BY ${orderBy}
    LIMIT ?`;
  params.push(limit);
  const rows = await all(db, sql, params);
  return {
    total: rows.length,
    units: rows.map((u) => ({ ...mapInventoryUnitApi(u), projectName: u.project_name || "" })),
  };
}

function parseInventoryAskJson(raw) {
  const text = String(raw || "").trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fence ? fence[1].trim() : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("GPT không trả JSON hợp lệ");
  return JSON.parse(body.slice(start, end + 1));
}

export function buildInventoryAskReply(intent, filters, units) {
  const n = units.length;
  if (!n) {
    if (intent === "clarify") {
      return "Anh/Chị cho mình biết rõ hơn: dự án nào, mã căn, loại căn (1BR/2BR) hoặc khoảng giá?";
    }
    return "Không tìm thấy căn phù hợp trong giỏ đã sync. Thử đổi điều kiện hoặc chọn dự án khác.";
  }
  const first = units[0];
  if (intent === "cheapest") {
    return n === 1
      ? `Căn rẻ nhất: ${first.unitCode} — ${Number(first.price || 0).toLocaleString("vi-VN")} ₫`
      : `Các căn giá thấp nhất (${n} căn):`;
  }
  if (intent === "drive") return `Có ${n} căn kèm link Drive/PTG:`;
  if (filters.unitCode) {
    return n === 1
      ? `Thông tin căn ${first.unitCode}:`
      : `Tìm thấy ${n} căn gần mã “${filters.unitCode}”:`;
  }
  return n === 1 ? `Thông tin căn ${first.unitCode}:` : `Tìm thấy ${n} căn phù hợp:`;
}

export async function parseInventoryQuestionWithGpt(apiKey, { question, projectNames = [], projectHint = "" }) {
  const system = `Bạn là bộ parse ý định tra cứu giỏ hàng BĐS (tiếng Việt).
Chỉ trả về ĐÚNG 1 JSON object, không markdown, không giải thích.
Schema:
{
  "intent": "search|cheapest|drive|count|clarify",
  "projectHint": "tên dự án nếu user nhắc, else ''",
  "unitCode": "mã căn nếu có (VD E11711), else ''",
  "layout": "1BR|2BR|3BR|Studio|... nếu có, else ''",
  "source": "mã đại lý STH|IQI|AKH|... nếu có, else ''",
  "building": "tòa/block nếu có, else ''",
  "direction": "hướng nếu có, else ''",
  "view": "view nếu có, else ''",
  "minPrice": number hoặc null (VND),
  "maxPrice": number hoặc null (VND),
  "hasDrive": boolean,
  "sort": "price_asc|price_desc|code",
  "limit": number 1-20
}
Quy tắc:
- "rẻ nhất/giá thấp" → intent=cheapest, sort=price_asc, limit=5
- "đắt nhất" → sort=price_desc, limit=5
- "link drive/ptg" → intent=drive, hasDrive=true
- Chỉ mã căn rõ → intent=search + unitCode
- Câu mơ hồ không đủ lọc → intent=clarify
- Giá "dưới 5 tỷ" → maxPrice=5000000000; "trên 10 tỷ" → minPrice=10000000000
- Không bịa field; field không chắc để '' hoặc null`;

  const userMsg = `Danh sách dự án có giỏ: ${projectNames.slice(0, 40).join(" | ") || "(chưa có)"}
Dự án đang chọn: ${projectHint || "(chưa chọn)"}
Câu hỏi sale: ${question}`;

  const gptRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4.1-nano",
      temperature: 0,
      max_tokens: 280,
      messages: [
        { role: "system", content: system },
        { role: "user", content: userMsg },
      ],
    }),
  });
  const errData = await gptRes.json().catch(() => ({}));
  if (!gptRes.ok) {
    const msg = errData.error?.message || `OpenAI HTTP ${gptRes.status}`;
    const err = new Error(msg);
    err.status = 502;
    throw err;
  }
  const content = errData.choices?.[0]?.message?.content || "";
  return parseInventoryAskJson(content);
}
